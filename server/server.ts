import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { load } from 'cheerio'; // CHANGED: Safer import
import { PinnedImage, Board, PinGroup, Collection, DiscoverySource } from './types';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); 

// --- PATHS ---
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'tallo.db');

if (!fs.existsSync(UPLOAD_DIR)) {
  console.log(`Creating upload directory at: ${UPLOAD_DIR}`);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOAD_DIR));

// --- DB SETUP ---
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Init Tables
const schema = `
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    url TEXT,
    title TEXT,
    description TEXT,
    tags TEXT,
    created_at INTEGER,
    owner_id TEXT,
    board_ids TEXT,
    visibility TEXT,
    is_favorite INTEGER,
    media_type TEXT,
    video_metadata TEXT,
    source_url TEXT,
    thumbnail_url TEXT,
    location TEXT,
    latitude REAL,
    longitude REAL
  );

  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    created_at INTEGER,
    cover_image_id TEXT,
    visibility TEXT,
    owner_id TEXT,
    collection_ids TEXT
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT,
    owner_id TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS pin_groups (
    id TEXT PRIMARY KEY,
    title TEXT,
    image_ids TEXT,
    created_at INTEGER,
    board_ids TEXT,
    owner_id TEXT
  );

  CREATE TABLE IF NOT EXISTS discovery_sources (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    feed_url TEXT,
    enabled INTEGER,
    owner_id TEXT,
    created_at INTEGER
  );
`;
db.exec(schema);

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fieldSize: 50 * 1024 * 1024,
    fileSize: 10 * 1024 * 1024 * 1024
  }
});

const parseJSON = (str: string | null) => {
    try { return str ? JSON.parse(str) : [] } catch { return [] }
};

// --- SCRAPING ENDPOINT (ROBUST) ---
app.post('/scrape', async (req, res) => {
  let { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Auto-prepend https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  console.log(`Scraping URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Target site returned ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = load(html); // Use the named export
    
    // Extract Metadata
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    
    // Extract Images
    const images = new Set<string>();
    
    // OG Image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) images.add(ogImage);

    // Scan img tags
    $('img').each((_, el) => {
      const $img = $(el);
      
      // Look for lazy-loaded attributes
      let src = $img.attr('data-src') || 
                $img.attr('data-lazy-src') || 
                $img.attr('data-original') || 
                $img.attr('src');

      // Handle srcset (take first URL)
      if (!src && $img.attr('srcset')) {
         src = $img.attr('srcset')?.split(' ')[0];
      }
      
      if (src) {
        // Basic filtering
        const width = $img.attr('width');
        const height = $img.attr('height');
        if (width && parseInt(width) < 100) return;
        if (height && parseInt(height) < 100) return;
        if (src.includes('.svg') || src.includes('logo')) return;
        if (src.startsWith('data:image')) return; 

        try {
            // Resolve relative URLs
            const absoluteUrl = new URL(src, url).href;
            images.add(absoluteUrl);
        } catch (e) {
            // Ignore invalid URLs
        }
      }
    });

    res.json({
      title: title.trim(),
      description: description.trim(),
      url: url,
      images: Array.from(images)
    });

  } catch (err: any) {
    console.error('Scraping Error:', err.message);
    // Send the actual error message back to the frontend for debugging
    res.status(500).json({ error: err.message || 'Failed to scrape website' });
  }
});

// --- ROUTES: IMAGES ---
app.get('/images', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM images ORDER BY created_at DESC').all() as any[];
    const images = rows.map(r => ({
      ...r,
      tags: parseJSON(r.tags),
      boardIds: parseJSON(r.board_ids),
      videoMetadata: r.video_metadata ? JSON.parse(r.video_metadata) : undefined,
      isFavorite: Boolean(r.is_favorite),
      ownerId: r.owner_id,
      mediaType: r.media_type,
      sourceUrl: r.source_url,
      thumbnailUrl: r.thumbnail_url,
      createdAt: r.created_at
    }));
    res.json(images);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/images', upload.single('file'), (req, res) => {
  try {
    const data: PinnedImage = JSON.parse(req.body.data || '{}');
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : data.url;

    const stmt = db.prepare(`
      INSERT INTO images (id, url, title, description, tags, created_at, owner_id, board_ids, visibility, is_favorite, media_type, video_metadata, source_url, thumbnail_url, location, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        tags=excluded.tags,
        board_ids=excluded.board_ids,
        visibility=excluded.visibility,
        is_favorite=excluded.is_favorite,
        location=excluded.location,
        latitude=excluded.latitude,
        longitude=excluded.longitude,
        thumbnail_url=excluded.thumbnail_url
    `);

    stmt.run(
      data.id,
      fileUrl,
      data.title,
      data.description || '',
      JSON.stringify(data.tags || []),
      data.createdAt || Date.now(),
      data.ownerId || 'user',
      JSON.stringify(data.boardIds || []),
      data.visibility || 'private',
      data.isFavorite ? 1 : 0,
      data.mediaType || 'image',
      JSON.stringify(data.videoMetadata || {}),
      data.sourceUrl || '',
      data.thumbnailUrl || fileUrl,
      data.location || '',
      data.latitude || null,
      data.longitude || null
    );
    res.json({ success: true, url: fileUrl });
  } catch (err: any) {
    console.error("Error saving image:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/images/:id', (req, res) => {
    db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- ROUTES: BOARDS ---
app.get('/boards', (req, res) => {
    const rows = db.prepare('SELECT * FROM boards').all() as any[];
    res.json(rows.map(r => ({
        ...r,
        collectionIds: parseJSON(r.collection_ids),
        ownerId: r.owner_id,
        createdAt: r.created_at,
        coverImageId: r.cover_image_id
    })));
});

app.post('/boards', (req, res) => {
    const d: Board = req.body;
    db.prepare(`
        INSERT OR REPLACE INTO boards (id, name, description, created_at, cover_image_id, visibility, owner_id, collection_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        d.id, d.name, d.description, d.createdAt, d.coverImageId, d.visibility, d.ownerId, JSON.stringify(d.collectionIds)
    );
    res.json({ success: true });
});

app.delete('/boards/:id', (req, res) => {
    db.prepare('DELETE FROM boards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- ROUTES: COLLECTIONS ---
app.get('/collections', (req, res) => {
    const rows = db.prepare('SELECT * FROM collections').all() as any[];
    res.json(rows.map(r => ({ ...r, ownerId: r.owner_id, createdAt: r.created_at })));
});

app.post('/collections', (req, res) => {
    const d: Collection = req.body;
    db.prepare('INSERT OR REPLACE INTO collections (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)').run(d.id, d.name, d.ownerId, d.createdAt);
    res.json({ success: true });
});

app.delete('/collections/:id', (req, res) => {
    db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- ROUTES: GROUPS ---
app.get('/groups', (req, res) => {
    const rows = db.prepare('SELECT * FROM pin_groups').all() as any[];
    res.json(rows.map(r => ({
        ...r,
        imageIds: parseJSON(r.image_ids),
        boardIds: parseJSON(r.board_ids),
        ownerId: r.owner_id,
        createdAt: r.created_at
    })));
});

app.post('/groups', (req, res) => {
    const d: PinGroup = req.body;
    db.prepare(`
        INSERT OR REPLACE INTO pin_groups (id, title, image_ids, created_at, board_ids, owner_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(d.id, d.title, JSON.stringify(d.imageIds), d.createdAt, JSON.stringify(d.boardIds), d.ownerId);
    res.json({ success: true });
});

app.delete('/groups/:id', (req, res) => {
    db.prepare('DELETE FROM pin_groups WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// --- ROUTES: DISCOVERY ---
app.get('/discovery', (req, res) => {
    const rows = db.prepare('SELECT * FROM discovery_sources').all() as any[];
    res.json(rows.map(r => ({ ...r, feedUrl: r.feed_url, ownerId: r.owner_id, createdAt: r.created_at, enabled: Boolean(r.enabled) })));
});

app.post('/discovery', (req, res) => {
    const d: DiscoverySource = req.body;
    db.prepare(`
        INSERT OR REPLACE INTO discovery_sources (id, name, type, feed_url, enabled, owner_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(d.id, d.name, d.type, d.feedUrl, d.enabled ? 1 : 0, d.ownerId, d.createdAt);
    res.json({ success: true });
});

app.delete('/discovery/:id', (req, res) => {
    db.prepare('DELETE FROM discovery_sources WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Backend running on ${PORT}`);
    console.log(`Storage Path: ${DATA_DIR}`);
});