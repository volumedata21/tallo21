import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { load } from 'cheerio';
import bcrypt from 'bcryptjs'; // - Security fix
import db from './db';
import { PinnedImage, Board, PinGroup, Collection, DiscoverySource } from '../shared/types';

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  console.log('[Server] Creating upload directory:', UPLOAD_DIR);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- FIX: Correct Multer Configuration ---
// changed fieldSize (metadata limit) to fileSize (actual file limit)
const upload = multer({ 
  dest: UPLOAD_DIR,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB Limit
});

// --- LOGGER MIDDLEWARE ---
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// --- API: Auth (SECURED) ---

app.post('/api/auth/register', async (req, res) => {
  const { id, username, password, createdAt, isAdmin } = req.body;
  
  try {
    // 1. Hash the password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const stmt = db.prepare(`INSERT INTO users (id, username, password_hash, created_at, is_admin) VALUES (?, ?, ?, ?, ?)`);
    
    // 2. Store the hash
    stmt.run(id, username, hashedPassword, createdAt, isAdmin ? 1 : 0);
    
    console.log(`[Auth] Registered user: ${username}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth] Register Error:', err.message);
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // 3. Securely compare password with stored hash
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`[Auth] Login successful: ${username}`);
    res.json({ id: user.id, username: user.username, createdAt: user.created_at, isAdmin: Boolean(user.is_admin) });
  } catch (err: any) {
    console.error('[Auth] Login Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, created_at, is_admin FROM users').all() as any[];
    res.json(users.map(u => ({ ...u, isAdmin: Boolean(u.is_admin) })));
  } catch (err: any) {
    console.error('[API] Fetch Users Error:', err.message);
    res.json([]);
  }
});

// --- API: Images ---

app.get('/api/images', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM images').all() as any[];
    const images = rows.map(row => ({
        ...row,
        tags: JSON.parse(row.tags || '[]'),
        boardIds: JSON.parse(row.board_ids || '[]'),
        likedBy: JSON.parse(row.liked_by || '[]'),
        videoMetadata: JSON.parse(row.video_metadata || 'null'),
        createdAt: row.created_at,
        ownerId: row.owner_id,
        isFavorite: Boolean(row.is_favorite),
        thumbnailUrl: row.thumbnail_url || row.url 
    }));
    // console.log(`[API] Fetched ${images.length} images`);
    res.json(images);
  } catch (err: any) {
    console.error('[API] Get Images Error:', err.message);
    res.json([]);
  }
});

// --- NEW ENDPOINT: Bulk Update (Performance Fix) ---
app.post('/api/images/bulk-update', (req, res) => {
  const { ids, updates } = req.body;
  
  if (!Array.isArray(ids) || !updates) return res.status(400).json({ error: 'Invalid data' });

  // Map allowed fields to DB columns
  // Note: We only allow specific fields to prevent arbitrary SQL injection via keys
  const allowedUpdates: Record<string, any> = {};
  if (updates.visibility) allowedUpdates.visibility = updates.visibility;
  if (updates.location) allowedUpdates.location = updates.location;
  if (updates.latitude) allowedUpdates.latitude = updates.latitude;
  if (updates.longitude) allowedUpdates.longitude = updates.longitude;
  
  // Handling array fields (tags, boardIds) requires reading, merging, and writing back
  // which is hard to do in a single simple SQL update. 
  // For simplicity in this SQLite setup, we will use a transaction loop.
  // This is still MUCH faster than 50 HTTP requests.

  const updateKeys = Object.keys(allowedUpdates).map(k => `${k} = @${k}`).join(', ');

  try {
    const transaction = db.transaction((targetIds) => {
        // 1. Simple Scalar Updates (Location, Visibility)
        if (updateKeys.length > 0) {
            const stmt = db.prepare(`UPDATE images SET ${updateKeys} WHERE id = @id`);
            for (const id of targetIds) {
                stmt.run({ ...allowedUpdates, id });
            }
        }

        // 2. Array Updates (Boards, Tags) - more complex
        if (updates.boardIdToAdd) {
             const getStmt = db.prepare('SELECT board_ids FROM images WHERE id = ?');
             const updateStmt = db.prepare('UPDATE images SET board_ids = ? WHERE id = ?');
             
             for (const id of targetIds) {
                 const row = getStmt.get(id) as any;
                 if (row) {
                     const currentBoards = JSON.parse(row.board_ids || '[]');
                     if (!currentBoards.includes(updates.boardIdToAdd)) {
                         currentBoards.push(updates.boardIdToAdd);
                         updateStmt.run(JSON.stringify(currentBoards), id);
                     }
                 }
             }
        }
        
        if (updates.tagsToAdd) {
             const getStmt = db.prepare('SELECT tags FROM images WHERE id = ?');
             const updateStmt = db.prepare('UPDATE images SET tags = ? WHERE id = ?');
             
             for (const id of targetIds) {
                 const row = getStmt.get(id) as any;
                 if (row) {
                     const currentTags = JSON.parse(row.tags || '[]');
                     const newTags = Array.from(new Set([...currentTags, ...updates.tagsToAdd]));
                     updateStmt.run(JSON.stringify(newTags), id);
                 }
             }
        }
    });

    transaction(ids);
    res.json({ success: true });

  } catch(err: any) {
    console.error("[Bulk Update] Failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images', upload.single('file'), (req, res) => {
  console.log('[API] Processing Image Upload...');
  try {
    let meta;
    try { meta = JSON.parse(req.body.data || '{}'); } 
    catch (e) { return res.status(400).json({ error: 'Invalid metadata JSON' }); }

    const file = req.file;
    const finalUrl = file ? `/uploads/${file.filename}` : meta.url;
    const mediaType = file && file.mimetype.startsWith('video') ? 'video' : 'image';
    
    // If it's an image file, use the original as thumbnail (or client provided one)
    // If it's a video file, we rely on the client-generated thumbnail or placeholder
    const thumbnail = mediaType === 'image' && file ? finalUrl : (meta.thumbnailUrl || '');

    const newImage = {
        id: meta.id,
        url: finalUrl,
        title: meta.title || '',
        description: meta.description || '',
        tags: meta.tags || [],
        createdAt: meta.createdAt || Date.now(),
        ownerId: meta.ownerId,
        boardIds: meta.boardIds || [],
        visibility: meta.visibility || 'private',
        isFavorite: meta.isFavorite ? 1 : 0,
        mediaType: mediaType,
        likedBy: meta.likedBy || [],
        videoMetadata: meta.videoMetadata || null,
        sourceUrl: meta.sourceUrl || '',
        thumbnailUrl: thumbnail,
        location: meta.location || '',
        latitude: meta.latitude || null,
        longitude: meta.longitude || null
    };

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO images (
        id, url, title, description, tags, created_at, owner_id, board_ids, 
        visibility, is_favorite, media_type, liked_by, video_metadata, 
        source_url, thumbnail_url, location, latitude, longitude
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      newImage.id, newImage.url, newImage.title, newImage.description, 
      JSON.stringify(newImage.tags), newImage.createdAt, newImage.ownerId, 
      JSON.stringify(newImage.boardIds), newImage.visibility, newImage.isFavorite, 
      newImage.mediaType, JSON.stringify(newImage.likedBy), 
      JSON.stringify(newImage.videoMetadata),
      newImage.sourceUrl, newImage.thumbnailUrl, newImage.location, newImage.latitude, newImage.longitude
    );
    
    console.log(`[API] Image Saved Successfully: ${newImage.id}`);
    
    // Return actual object for frontend state update
    res.json({
        ...newImage,
        isFavorite: Boolean(newImage.isFavorite)
    });

  } catch (err: any) {
    console.error("[API] Upload CRASH:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/images/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
        console.log(`[API] Deleted image: ${req.params.id}`);
        res.json({ success: true });
    } catch (err: any) {
        console.error('[API] Delete Image Error:', err);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// --- API: Boards ---

app.get('/api/boards', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM boards').all() as any[];
        res.json(rows.map(r => ({ ...r, collectionIds: JSON.parse(r.collection_ids || '[]'), createdAt: r.created_at, ownerId: r.owner_id })));
    } catch (err) { res.json([]); }
});

app.post('/api/boards', (req, res) => {
    const b: Board = req.body;
    try {
        db.prepare(`INSERT OR REPLACE INTO boards (id, name, description, created_at, owner_id, collection_ids, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(b.id, b.name, b.description, b.createdAt, b.ownerId, JSON.stringify(b.collectionIds), b.visibility);
        console.log(`[API] Saved board: ${b.name}`);
        res.json({ success: true });
    } catch (err: any) {
        console.error('[API] Save Board Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/boards/:id', (req, res) => {
    db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- API: Other ---
app.get('/api/collections', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM collections').all() as any[];
        res.json(rows.map(r => ({ ...r, createdAt: r.created_at, ownerId: r.owner_id })));
    } catch (err) { res.json([]); }
});

app.post('/api/collections', (req, res) => {
    const c: Collection = req.body;
    db.prepare(`INSERT OR REPLACE INTO collections (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)`).run(c.id, c.name, c.ownerId, c.createdAt);
    res.json({ success: true });
});

app.get('/api/groups', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM pin_groups').all() as any[];
        res.json(rows.map(r => ({ ...r, imageIds: JSON.parse(r.image_ids || '[]'), boardIds: JSON.parse(r.board_ids || '[]'), createdAt: r.created_at, ownerId: r.owner_id })));
    } catch (err) { res.json([]); }
});

app.post('/api/groups', (req, res) => {
    const g: PinGroup = req.body;
    db.prepare(`INSERT OR REPLACE INTO pin_groups (id, title, image_ids, created_at, board_ids, owner_id) VALUES (?, ?, ?, ?, ?, ?)`).run(g.id, g.title, JSON.stringify(g.imageIds), g.createdAt, JSON.stringify(g.boardIds), g.ownerId);
    res.json({ success: true });
});

app.delete('/api/groups/:id', (req, res) => { db.prepare('DELETE FROM pin_groups WHERE id = ?').run(req.params.id); res.json({ success: true }); });

app.get('/api/discovery', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM discovery_sources').all() as any[];
        res.json(rows.map(r => ({ ...r, feedUrl: r.feed_url, ownerId: r.owner_id, createdAt: r.created_at, enabled: Boolean(r.enabled) })));
    } catch (err) { res.json([]); }
});

app.post('/api/discovery', (req, res) => {
    const d: DiscoverySource = req.body;
    db.prepare(`INSERT OR REPLACE INTO discovery_sources (id, name, type, feed_url, enabled, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(d.id, d.name, d.type, d.feedUrl, d.enabled ? 1 : 0, d.ownerId, d.createdAt);
    res.json({ success: true });
});

app.delete('/api/discovery/:id', (req, res) => { db.prepare('DELETE FROM discovery_sources WHERE id = ?').run(req.params.id); res.json({ success: true }); });

// --- API: Scraping & Proxy ---

app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    console.log(`[Scrape] Fetching: ${url}`);
    
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Tallo-Bot)' } });
    const html = await response.text();
    const $ = load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const description = $('meta[property="og:description"]').attr('content') || '';
    const images = new Set<string>();
    
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.startsWith('data:')) { 
        try { images.add(new URL(src, url).href); } catch (e) {} 
      }
    });
    res.json({ title, description, url, images: Array.from(images) });
  } catch (err: any) { 
    console.error('[Scrape] Error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// --- FIX: Secure RSS Proxy ---
app.get('/api/rss', async (req, res) => {
  const { url: targetUrl } = req.query;
  if (typeof targetUrl !== 'string') return res.status(400).send('URL required');
  
  try {
    const urlObj = new URL(targetUrl);
    // Simple block for localhost/private IPs to prevent SSRF
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.hostname.startsWith('192.168.') || urlObj.hostname.startsWith('10.')) {
      return res.status(403).send('Access to local network denied');
    }

    const response = await fetch(targetUrl); 
    const data = await response.text(); 
    res.set('Content-Type', 'text/xml'); 
    res.send(data); 
  } catch (e) { 
      console.error('[RSS] Error:', e);
      res.status(500).send('Failed to fetch RSS'); 
  }
});

// --- STATIC FILES ---
app.use('/uploads', express.static(UPLOAD_DIR));

if (process.env.NODE_ENV === 'production') {
  const CLIENT_PATH = path.join(process.cwd(), 'dist');
  app.use(express.static(CLIENT_PATH));
  app.get('*', (req, res) => { 
      if (!req.path.startsWith('/api')) res.sendFile(path.join(CLIENT_PATH, 'index.html')); 
  });
}

app.listen(PORT, () => console.log(`[System] Tallo Server running on port ${PORT}`));