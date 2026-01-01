import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from './database';
import { Pin } from './types'; 
import sharp from 'sharp'; 
import { JSDOM } from 'jsdom'; 

const app = express();
const PORT = 3001;
const NEW_STEMS_ID = 'b-new-stems';

const DATA_DIR = process.env.DATA_DIR || './data';
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/images', express.static(IMAGES_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

// --- DB Helpers ---
const run = (sql: string, params: any[] = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
});
const get = (sql: string, params: any[] = []) => new Promise<any>((resolve, reject) => {
  db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});
const all = (sql: string, params: any[] = []) => new Promise<any[]>((resolve, reject) => {
  db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

const parsePin = (pin: any): Pin => ({
  ...pin,
  gallery: JSON.parse(pin.gallery || '[]'),
  boardIds: JSON.parse(pin.boardIds || '[]'),
  location: pin.location ? JSON.parse(pin.location) : undefined,
  tags: JSON.parse(pin.tags || '[]'),
  favorite: !!pin.favorite,
  deletedAt: pin.deletedAt || undefined,
  thumbnail: pin.thumbnail || undefined
});

// --- HELPER: DOWNLOAD & OPTIMIZE EXTERNAL IMAGES ---
const processExternalImage = async (url: string) => {
    if (!url || !url.startsWith('http')) return { url, thumbnail: null };

    try {
        console.log(`Downloading external image: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const date = new Date();
        const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const targetDir = path.join(IMAGES_DIR, folder);
        const thumbDir = path.join(THUMBNAILS_DIR, folder);

        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

        const id = Date.now() + '-' + Math.round(Math.random() * 1000);
        const contentType = response.headers.get('content-type');
        
        const isVideo = contentType?.startsWith('video/');
        
        let ext = '.jpg';
        if (contentType?.includes('png')) ext = '.png';
        if (contentType?.includes('webp')) ext = '.webp';
        if (contentType?.includes('gif')) ext = '.gif';
        if (isVideo) ext = '.mp4';
        
        const filename = `${id}${ext}`;
        const originalPath = path.join(targetDir, filename);
        
        await fs.promises.writeFile(originalPath, buffer);

        if (isVideo) {
             return {
                url: `/images/${folder}/${filename}`,
                thumbnail: null 
            };
        }

        const thumbFilename = `${id}.webp`;
        const thumbPath = path.join(thumbDir, thumbFilename);
        
        await sharp(buffer)
            .resize(600, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 80 })
            .toFile(thumbPath);

        return {
            url: `/images/${folder}/${filename}`,
            thumbnail: `/thumbnails/${folder}/${thumbFilename}`
        };
    } catch (e) {
        console.error("Error processing external image:", e);
        return { url, thumbnail: null }; 
    }
};

// --- MIGRATION SYSTEM ---
const runMigrations = async () => {
    try {
        await run(`CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT, appliedAt INTEGER)`);
        
        const migrations = [
            { id: 1, name: 'add_deleted_at_to_pins', sql: "ALTER TABLE pins ADD COLUMN deletedAt INTEGER DEFAULT NULL" },
            { id: 2, name: 'add_thumbnail_to_pins', sql: "ALTER TABLE pins ADD COLUMN thumbnail TEXT DEFAULT NULL" }
        ];

        for (const m of migrations) {
            const exists = await get("SELECT * FROM migrations WHERE id = ?", [m.id]);
            if (!exists) {
                console.log(`Applying migration ${m.id}: ${m.name}...`);
                try {
                    await run(m.sql);
                    await run("INSERT INTO migrations (id, name, appliedAt) VALUES (?, ?, ?)", [m.id, m.name, Date.now()]);
                } catch (e: any) {
                    if (e.message.includes('duplicate column')) {
                        await run("INSERT INTO migrations (id, name, appliedAt) VALUES (?, ?, ?)", [m.id, m.name, Date.now()]);
                    } else {
                        console.error(`Migration ${m.id} failed:`, e);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Migration check failed", e);
    }
};

const ensureDefaultData = async () => {
    try {
        const user = await get("SELECT * FROM users LIMIT 1");
        if (!user) {
            await run(`INSERT INTO users (id, username, email, isAdmin, usedQuota, maxQuota, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`, ['u1', 'Admin', 'admin@tallo.local', 1, '0GB', '5GB', Date.now()]);
        }
        const board = await get("SELECT * FROM boards WHERE id = ?", [NEW_STEMS_ID]);
        if (!board) {
            await run(`INSERT INTO boards (id, title, ownerId) VALUES (?, ?, ?)`, [NEW_STEMS_ID, 'New Stems', 'u1']);
        }
    } catch (err) {
        console.error("Default data check failed", err);
    }
};

runMigrations().then(ensureDefaultData);

// --- ROUTES ---

app.get('/', (req, res) => res.send('Tallo API Running'));

app.get('/api/users', async (req, res) => {
    const rows = await all("SELECT * FROM users");
    res.json(rows);
});
app.get('/api/users/current', async (req, res) => {
  let user = await get("SELECT * FROM users LIMIT 1");
  if (!user) user = { id: 'u1', username: 'Fallback Admin', isAdmin: true };
  res.json(user);
});

// COLLECTIONS
app.get('/api/collections', async (req, res) => {
  const rows = await all("SELECT * FROM collections WHERE ownerId = ?", [req.query.userId]);
  res.json(rows);
});

// --- UPDATED CREATE COLLECTION (Dupe Check) ---
app.post('/api/collections', async (req, res) => {
  const { title, ownerId } = req.body;
  
  // Check for duplicate title (case insensitive) for this owner
  const existing = await get("SELECT id FROM collections WHERE lower(title) = lower(?) AND ownerId = ?", [title, ownerId]);
  if (existing) {
      return res.status(400).json({ error: "A collection with this name already exists." });
  }

  const id = uuidv4();
  await run("INSERT INTO collections (id, title, ownerId) VALUES (?, ?, ?)", [id, title, ownerId]);
  res.json(await get("SELECT * FROM collections WHERE id = ?", [id]));
});

// --- UPDATED UPDATE COLLECTION (Dupe Check) ---
app.put('/api/collections/:id', async (req, res) => {
    const { title } = req.body;
    
    // If title is changing, check for duplicates
    if (title !== undefined) {
        const currentCol = await get("SELECT ownerId FROM collections WHERE id = ?", [req.params.id]);
        if (currentCol) {
            const existing = await get("SELECT id FROM collections WHERE lower(title) = lower(?) AND ownerId = ? AND id != ?", [title, currentCol.ownerId, req.params.id]);
            if (existing) {
                return res.status(400).json({ error: "A collection with this name already exists." });
            }
        }
    }

    await run("UPDATE collections SET title = ? WHERE id = ?", [title, req.params.id]);
    res.json({ success: true });
});

// --- NEW DELETE COLLECTION ---
app.delete('/api/collections/:id', async (req, res) => {
    // 1. Move all boards in this collection to "Unorganized" (collectionId = NULL)
    await run("UPDATE boards SET collectionId = NULL WHERE collectionId = ?", [req.params.id]);
    
    // 2. Delete the collection
    await run("DELETE FROM collections WHERE id = ?", [req.params.id]);
    
    res.json({ success: true });
});

// BOARDS
app.get('/api/boards', async (req, res) => {
  const rows = await all("SELECT * FROM boards WHERE ownerId = ? OR id = ?", [req.query.userId, NEW_STEMS_ID]);
  res.json(rows);
});

app.post('/api/boards', async (req, res) => {
  const { title, collectionId, ownerId } = req.body;
  const existing = await get("SELECT id FROM boards WHERE lower(title) = lower(?) AND ownerId = ?", [title, ownerId]);
  if (existing) return res.status(400).json({ error: "A board with this name already exists." });

  const id = uuidv4();
  await run("INSERT INTO boards (id, title, collectionId, ownerId) VALUES (?, ?, ?, ?)", [id, title, collectionId, ownerId]);
  res.json(await get("SELECT * FROM boards WHERE id = ?", [id]));
});

app.put('/api/boards/:id', async (req, res) => {
    const { title, collectionId } = req.body;
    if (title !== undefined) {
        const currentBoard = await get("SELECT ownerId FROM boards WHERE id = ?", [req.params.id]);
        if (currentBoard) {
            const existing = await get("SELECT id FROM boards WHERE lower(title) = lower(?) AND ownerId = ? AND id != ?", [title, currentBoard.ownerId, req.params.id]);
            if (existing) return res.status(400).json({ error: "A board with this name already exists." });
        }
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(title); }
    if (collectionId !== undefined) { updates.push("collectionId = ?"); values.push(collectionId); }
    if (updates.length > 0) {
        values.push(req.params.id);
        await run(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    res.json({ success: true });
});

app.delete('/api/boards/:id', async (req, res) => {
  if (req.params.id === NEW_STEMS_ID) return res.status(403).json({ error: "Cannot delete permanent board" });
  await run("DELETE FROM boards WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// PINS
app.get('/api/pins', async (req, res) => {
  try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      const { sort, search, boardId, favorites, tag } = req.query;

      let sql = "SELECT * FROM pins WHERE deletedAt IS NULL";
      const params: any[] = [];

      if (favorites === 'true') {
          sql += " AND favorite = 1";
      }
      
      if (search) {
          sql += " AND (title LIKE ? OR description LIKE ?)";
          params.push(`%${search}%`, `%${search}%`);
      }

      if (boardId) {
          sql += " AND boardIds LIKE ?";
          params.push(`%${boardId}%`);
      }

      if (tag) {
          sql += " AND tags LIKE ?";
          params.push(`%${tag}%`);
      }
      
      let orderBy = 'createdAt DESC'; 
      
      if (sort === 'oldest') orderBy = 'createdAt ASC';
      else if (sort === 'az') orderBy = 'title ASC';
      else if (sort === 'za') orderBy = 'title DESC';
      else if (sort === 'random') orderBy = 'RANDOM()'; 

      sql += ` ORDER BY ${orderBy}`;
      sql += " LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const rows = await all(sql, params);
      const pins = rows.map(parsePin);
      
      res.json(pins);
  } catch (e) {
      console.error("Fetch pins error:", e);
      res.status(500).json({ error: "Failed to fetch pins" });
  }
});

app.post('/api/pins', async (req, res) => {
    const pin = req.body;
    const id = uuidv4();
    let boardIds = pin.boardIds || [];
    if (boardIds.length === 0) boardIds = [NEW_STEMS_ID];

    let finalImageUrl = pin.imageUrl;
    let finalThumbnail = pin.thumbnail;

    if (pin.imageUrl && pin.imageUrl.startsWith('http')) {
        const processed = await processExternalImage(pin.imageUrl);
        finalImageUrl = processed.url;
        if (processed.thumbnail) finalThumbnail = processed.thumbnail;
    }

    await run(
      `INSERT INTO pins (id, title, description, imageUrl, thumbnail, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite, deletedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pin.title, pin.description, finalImageUrl, finalThumbnail || null, JSON.stringify(pin.gallery || []), JSON.stringify(boardIds), pin.link, JSON.stringify(pin.location || null), pin.aspectRatio, JSON.stringify(pin.tags || []), pin.ownerId, Date.now(), 0, null]
    );
    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.put('/api/pins/:id', async (req, res) => {
    const updates = req.body;
    const id = req.params.id;
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.boardIds && updates.boardIds.length === 0) {
        updates.boardIds = [NEW_STEMS_ID];
    }

    Object.keys(updates).forEach(key => {
        if(key === 'id') return;
        let val = updates[key];
        if (['gallery', 'boardIds', 'tags', 'location'].includes(key)) val = JSON.stringify(val);
        if (key === 'favorite') val = val ? 1 : 0;
        fields.push(`${key} = ?`);
        values.push(val);
    });
    if (fields.length === 0) return res.json({ success: true });
    values.push(id);
    await run(`UPDATE pins SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.delete('/api/pins/:id', async (req, res) => {
  await run("UPDATE pins SET deletedAt = ? WHERE id = ?", [Date.now(), req.params.id]);
  res.json({ success: true });
});

app.post('/api/pins/restore', async (req, res) => {
  const { id } = req.body;
  await run("UPDATE pins SET deletedAt = NULL WHERE id = ?", [id]);
  res.json({ success: true });
});

app.post('/api/pins/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const params = [Date.now(), ...ids];
  await run(`UPDATE pins SET deletedAt = ? WHERE id IN (${placeholders})`, params);
  res.json({ success: true });
});

app.post('/api/pins/bulk-update', async (req, res) => {
  const { ids, updates } = req.body;
  if (!ids || !ids.length) return res.json({ success: false });

  if (updates.boardIds && updates.boardIds.length === 0) {
      updates.boardIds = [NEW_STEMS_ID];
  }

  const fields: string[] = [];
  const values: any[] = [];

  Object.keys(updates).forEach(key => {
      let val = updates[key];
      if (['location', 'tags', 'boardIds', 'gallery'].includes(key)) val = JSON.stringify(val);
      fields.push(`${key} = ?`);
      values.push(val);
  });

  if (fields.length === 0) return res.json({ success: true });
  values.push(...ids);
  const placeholders = ids.map(() => '?').join(',');
  await run(`UPDATE pins SET ${fields.join(', ')} WHERE id IN (${placeholders})`, values);
  res.json({ success: true });
});

app.post('/api/pins/bulk-tags', async (req, res) => {
  const { ids, tags } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, tags FROM pins WHERE id IN (${placeholders})`, ids);
  for (const row of rows) {
      const currentTags: string[] = JSON.parse(row.tags || '[]');
      const newSet = new Set([...currentTags, ...tags]);
      await run("UPDATE pins SET tags = ? WHERE id = ?", [JSON.stringify(Array.from(newSet)), row.id]);
  }
  res.json({ success: true });
});

app.post('/api/pins/bulk-boards', async (req, res) => {
  const { ids, boardId } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, boardIds FROM pins WHERE id IN (${placeholders})`, ids);
  for (const row of rows) {
      let currentBoards: string[] = JSON.parse(row.boardIds || '[]');
      if (currentBoards.includes(NEW_STEMS_ID) && currentBoards.length === 1 && boardId !== NEW_STEMS_ID) {
          currentBoards = [];
      }
      if (!currentBoards.includes(boardId)) {
          currentBoards.push(boardId);
          await run("UPDATE pins SET boardIds = ? WHERE id = ?", [JSON.stringify(currentBoards), row.id]);
      }
  }
  res.json({ success: true });
});

app.post('/api/pins/bulk-boards-remove', async (req, res) => {
  const { ids, boardId } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, boardIds FROM pins WHERE id IN (${placeholders})`, ids);
  for (const row of rows) {
      let currentBoards: string[] = JSON.parse(row.boardIds || '[]');
      if (currentBoards.includes(boardId)) {
          currentBoards = currentBoards.filter(id => id !== boardId);
          if (currentBoards.length === 0) currentBoards.push(NEW_STEMS_ID);
          await run("UPDATE pins SET boardIds = ? WHERE id = ?", [JSON.stringify(currentBoards), row.id]);
      }
  }
  res.json({ success: true });
});

app.post('/api/pins/merge', async (req, res) => {
  const { ids } = req.body;
  if (!ids || ids.length < 2) return res.status(400).json({ error: "Need at least 2 pins" });
  
  const placeholders = ids.map(() => '?').join(',');
  const pins = await all(`SELECT * FROM pins WHERE id IN (${placeholders})`, ids);
  if (pins.length < 2) return res.status(400).json({ error: "Pins not found" });

  const targetId = ids[0];
  const targetPin = pins.find(p => p.id === targetId);
  const sourcePins = pins.filter(p => p.id !== targetId);

  if (!targetPin) return res.status(404).json({ error: "Target pin not found" });

  let targetGallery: string[] = [];
  try { targetGallery = JSON.parse(targetPin.gallery || '[]'); } catch (e) {}

  const sourceImages: string[] = [];
  sourcePins.forEach(p => {
      sourceImages.push(p.imageUrl);
      try {
          const g = JSON.parse(p.gallery || '[]');
          sourceImages.push(...g);
      } catch (e) {}
  });

  const newGallery = Array.from(new Set([...targetGallery, ...sourceImages]));
  await run("UPDATE pins SET gallery = ? WHERE id = ?", [JSON.stringify(newGallery), targetId]);

  const sourceIds = sourcePins.map(p => p.id);
  const delPlaceholders = sourceIds.map(() => '?').join(',');
  await run(`UPDATE pins SET deletedAt = ? WHERE id IN (${delPlaceholders})`, [Date.now(), ...sourceIds]);

  res.json({ success: true, mergedPinId: targetId });
});

app.post('/api/pins/ungroup', async (req, res) => {
  const { id } = req.body;
  const pin = await get("SELECT * FROM pins WHERE id = ?", [id]);
  if (!pin) return res.status(404).json({ error: "Pin not found" });

  const gallery: string[] = JSON.parse(pin.gallery || '[]');
  if (gallery.length === 0) return res.json({ success: true });

  for (const imgUrl of gallery) {
      const newId = uuidv4();
      await run(
        `INSERT INTO pins (id, title, description, imageUrl, thumbnail, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite, deletedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, pin.title, pin.description, imgUrl, null, '[]', pin.boardIds, pin.link, pin.location, 1, pin.tags, pin.ownerId, Date.now(), 0, null]
      );
  }
  await run("UPDATE pins SET gallery = ? WHERE id = ?", ['[]', id]);
  res.json({ success: true });
});

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        console.log(`Scraping: ${url}`);
        const extractedImages = new Set<string>();
        let scrapedTitle = '';

        try {
            const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const oembedRes = await fetch(oembedUrl);
            const oembedData = await oembedRes.json();
            
            if (oembedData.title) scrapedTitle = oembedData.title;
            if (oembedData.thumbnail_url) extractedImages.add(oembedData.thumbnail_url);
            
            if (oembedData.provider_name === 'YouTube' || oembedData.provider_name === 'Vimeo') {
                console.log(`[Scraper] Detected Video via oEmbed: ${oembedData.title}`);
            }
        } catch (e) {
            console.warn("oEmbed failed, falling back to standard scraper");
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        if (response.ok) {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.startsWith('image/')) {
                 return res.json({ images: [url], title: '' });
            }
            
            const html = await response.text();
            
            if (url.includes('behance.net')) {
                const cleanHtml = html.replace(/\\\//g, '/');
                const behanceRegex = /https?:\/\/(?:mir-s3-cdn-cf|m)\.behance\.net\/project_modules\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp|gif|avif)/gi;
                const matches = cleanHtml.match(behanceRegex);
                if (matches) matches.forEach(m => { if (!m.includes('/min_') && !m.includes('/disp_')) extractedImages.add(m); });
            }

            const dom = new JSDOM(html);
            const doc = dom.window.document;

            if (!scrapedTitle) {
                scrapedTitle = doc.querySelector('title')?.textContent || '';
                const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
                if (ogTitle) scrapedTitle = ogTitle;
            }

            const metaSelectors = ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'link[rel="image_src"]'];
            metaSelectors.forEach(selector => {
                doc.querySelectorAll(selector).forEach((el: any) => {
                    const content = el.getAttribute('content') || el.getAttribute('href');
                    if (content) try { extractedImages.add(new URL(content, url).href); } catch(e){}
                });
            });

            doc.querySelectorAll('img').forEach((img: any) => {
                const candidateSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src;
                if (candidateSrc && !candidateSrc.startsWith('data:')) {
                    try {
                        const width = img.getAttribute('width');
                        if (width && parseInt(width) < 50) return;
                        extractedImages.add(new URL(candidateSrc, url).href);
                    } catch (e) {}
                }
            });
        }

        const imageList = Array.from(extractedImages)
            .filter(img => !img.endsWith('.svg') && !img.includes('favicon'));

        res.json({ 
            images: imageList.slice(0, 50),
            title: scrapedTitle.trim()
        });

    } catch (error: any) {
        console.error("Scrape error:", error);
        res.status(500).json({ error: "Failed to scrape URL" });
    }
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const date = new Date();
  const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  
  const targetDir = path.join(IMAGES_DIR, folder);
  const thumbTargetDir = path.join(THUMBNAILS_DIR, folder);
  
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  if (!fs.existsSync(thumbTargetDir)) fs.mkdirSync(thumbTargetDir, { recursive: true });

  const filename = `${Date.now()}-${req.file.originalname}`;
  const originalPath = path.join(targetDir, filename);

  const isVideo = req.file.mimetype.startsWith('video/');
  let thumbFilename = filename.replace(/\.[^/.]+$/, "") + ".webp"; 
  if(isVideo) thumbFilename = filename; 

  const thumbnailPath = path.join(thumbTargetDir, thumbFilename);

  try {
      await fs.promises.writeFile(originalPath, req.file.buffer);
      let thumbUrl = null;

      if (!isVideo) {
          await sharp(req.file.buffer)
            .resize(600, null, { withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 80 })
            .toFile(thumbnailPath);
          thumbUrl = `/thumbnails/${folder}/${thumbFilename}`;
      }

      res.json({ 
          url: `/images/${folder}/${filename}`,
          thumbnail: thumbUrl
      });
  } catch (err) {
      console.error("Upload failed", err);
      if (!fs.existsSync(originalPath)) await fs.promises.writeFile(originalPath, req.file.buffer);
      res.json({ url: `/images/${folder}/${filename}` });
  }
});

app.get('/api/settings', async (req, res) => {
  let settings = await get("SELECT * FROM settings WHERE id = 'default'");
  res.json(settings || { maxUploadSize: '50MB' });
});
app.post('/api/settings', async (req, res) => {
  await run("UPDATE settings SET maxUploadSize = ? WHERE id = 'default'", [req.body.maxUploadSize]);
  res.json({ success: true });
});

app.post('/api/admin/regenerate-thumbnails', async (req, res) => {
    try {
        console.log("Starting thumbnail regeneration...");
        const pins = await all("SELECT * FROM pins WHERE thumbnail IS NULL OR thumbnail = ''");
        let count = 0;
        const errors = [];

        for (const pin of pins) {
            if (pin.imageUrl && pin.imageUrl.startsWith('http')) {
                const processed = await processExternalImage(pin.imageUrl);
                if (processed.url !== pin.imageUrl) { 
                    await run("UPDATE pins SET imageUrl = ?, thumbnail = ? WHERE id = ?", [processed.url, processed.thumbnail, pin.id]);
                    count++;
                }
            } else {
                if (pin.imageUrl.endsWith('.mp4') || pin.imageUrl.endsWith('.mov')) continue;

                const parts = pin.imageUrl.split('/').filter((p: string) => p.length > 0);
                if (parts.length >= 2) {
                    const filename = parts[parts.length - 1];
                    const subfolder = parts.length > 2 ? parts[parts.length - 2] : '';
                    const originalDir = subfolder ? path.join(IMAGES_DIR, subfolder) : IMAGES_DIR;
                    const originalPath = path.join(originalDir, filename);

                    if (fs.existsSync(originalPath)) {
                        try {
                            const thumbDir = subfolder ? path.join(THUMBNAILS_DIR, subfolder) : THUMBNAILS_DIR;
                            if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

                            const thumbFilename = filename.replace(/\.[^/.]+$/, "") + ".webp";
                            const thumbPath = path.join(thumbDir, thumbFilename);

                            await sharp(originalPath)
                                .resize(600, null, { withoutEnlargement: true, fit: 'inside' })
                                .webp({ quality: 80 })
                                .toFile(thumbPath);

                            const thumbUrl = `/thumbnails/${subfolder}/${thumbFilename}`;
                            await run("UPDATE pins SET thumbnail = ? WHERE id = ?", [thumbUrl, pin.id]);
                            count++;
                        } catch (e: any) {
                            errors.push(pin.id);
                        }
                    }
                }
            }
        }
        res.json({ success: true, processed: count, errors });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Regeneration failed" });
    }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));