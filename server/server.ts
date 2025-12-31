import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from './database';
import { Pin, User } from './types';

const app = express();
const PORT = 3001;

const DATA_DIR = process.env.DATA_DIR || './data';
const IMAGES_DIR = path.join(DATA_DIR, 'images');

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/images', express.static(IMAGES_DIR));

// DB Helpers
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
  favorite: !!pin.favorite
});

// --- SELF-HEALING: Ensure Default User Exists ---
const ensureDefaultUser = async () => {
  try {
    const user = await get("SELECT * FROM users LIMIT 1");
    if (!user) {
      console.log("Database empty. Creating default Admin user...");
      await run(`
                INSERT INTO users (id, username, email, profileImage, isAdmin, usedQuota, maxQuota, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, ['u1', 'Admin', 'admin@tallo.local', '', 1, '0GB', '5GB', Date.now()]);
    }
  } catch (err) {
    console.error("Failed to check/create default user:", err);
  }
};
ensureDefaultUser();


// --- Routes ---

app.get('/', (req, res) => res.send('Tallo API Running'));

// --- USERS ---
app.get('/api/users', async (req, res) => {
  try {
    const rows = await all("SELECT * FROM users");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get('/api/users/current', async (req, res) => {
  let user = await get("SELECT * FROM users LIMIT 1");
  if (!user) user = { id: 'u1', username: 'Fallback Admin', isAdmin: true };
  res.json(user);
});


// --- COLLECTIONS ---
app.get('/api/collections', async (req, res) => {
  const rows = await all("SELECT * FROM collections WHERE ownerId = ?", [req.query.userId]);
  res.json(rows);
});
app.post('/api/collections', async (req, res) => {
  const { title, ownerId } = req.body;
  const id = uuidv4();
  await run("INSERT INTO collections (id, title, ownerId) VALUES (?, ?, ?)", [id, title, ownerId]);
  res.json(await get("SELECT * FROM collections WHERE id = ?", [id]));
});

// --- BOARDS ---
app.get('/api/boards', async (req, res) => {
  const rows = await all("SELECT * FROM boards WHERE ownerId = ?", [req.query.userId]);
  res.json(rows);
});
app.post('/api/boards', async (req, res) => {
  const { title, collectionId, ownerId } = req.body;
  const id = uuidv4();
  await run("INSERT INTO boards (id, title, collectionId, ownerId) VALUES (?, ?, ?, ?)", [id, title, collectionId, ownerId]);
  res.json(await get("SELECT * FROM boards WHERE id = ?", [id]));
});

app.put('/api/boards/:id', async (req, res) => {
  const { title, collectionId } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (title !== undefined) {
    updates.push("title = ?");
    values.push(title);
  }
  if (collectionId !== undefined) {
    updates.push("collectionId = ?");
    values.push(collectionId);
  }

  if (updates.length > 0) {
    values.push(req.params.id);
    await run(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  res.json({ success: true });
});

// Add this NEW route for collections
app.put('/api/collections/:id', async (req, res) => {
  const { title } = req.body;
  await run("UPDATE collections SET title = ? WHERE id = ?", [title, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/boards/:id', async (req, res) => {
  await run("DELETE FROM boards WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- PINS ---
app.get('/api/pins', async (req, res) => {
  const rows = await all("SELECT * FROM pins");
  const pins = rows.map(parsePin);
  res.json(pins);
});
app.post('/api/pins', async (req, res) => {
  const pin = req.body;
  const id = uuidv4();
  await run(
    `INSERT INTO pins (id, title, description, imageUrl, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, pin.title, pin.description, pin.imageUrl, JSON.stringify(pin.gallery || []), JSON.stringify(pin.boardIds || []), pin.link, JSON.stringify(pin.location || null), pin.aspectRatio, JSON.stringify(pin.tags || []), pin.ownerId, Date.now(), 0]
  );
  res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});
app.put('/api/pins/:id', async (req, res) => {
  const updates = req.body;
  const id = req.params.id;
  const fields: string[] = [];
  const values: any[] = [];
  Object.keys(updates).forEach(key => {
    if (key === 'id') return;
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
  await run("DELETE FROM pins WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

// --- BULK ACTIONS ---

// 1. Bulk Delete
app.post('/api/pins/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  await run(`DELETE FROM pins WHERE id IN (${placeholders})`, ids);
  res.json({ success: true });
});

// 2. Bulk Update (General)
app.post('/api/pins/bulk-update', async (req, res) => {
  const { ids, updates } = req.body;
  if (!ids || !ids.length) return res.json({ success: false });

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

// 3. Bulk Add Tags
app.post('/api/pins/bulk-tags', async (req, res) => {
  const { ids, tags } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, tags FROM pins WHERE id IN (${placeholders})`, ids);

  for (const row of rows) {
    const currentTags: string[] = JSON.parse(row.tags || '[]');
    const newSet = new Set([...currentTags, ...tags]);
    const updatedTags = JSON.stringify(Array.from(newSet));
    await run("UPDATE pins SET tags = ? WHERE id = ?", [updatedTags, row.id]);
  }
  res.json({ success: true });
});

// 4. Bulk Add to Board
app.post('/api/pins/bulk-boards', async (req, res) => {
  const { ids, boardId } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, boardIds FROM pins WHERE id IN (${placeholders})`, ids);

  for (const row of rows) {
    const currentBoards: string[] = JSON.parse(row.boardIds || '[]');
    if (!currentBoards.includes(boardId)) {
      currentBoards.push(boardId);
      await run("UPDATE pins SET boardIds = ? WHERE id = ?", [JSON.stringify(currentBoards), row.id]);
    }
  }
  res.json({ success: true });
});

// 4.1 Bulk Remove from Board
app.post('/api/pins/bulk-boards-remove', async (req, res) => {
  const { ids, boardId } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, boardIds FROM pins WHERE id IN (${placeholders})`, ids);

  for (const row of rows) {
    let currentBoards: string[] = JSON.parse(row.boardIds || '[]');
    if (currentBoards.includes(boardId)) {
      currentBoards = currentBoards.filter(id => id !== boardId);
      await run("UPDATE pins SET boardIds = ? WHERE id = ?", [JSON.stringify(currentBoards), row.id]);
    }
  }
  res.json({ success: true });
});
// 5. MERGE PINS (Group into one)
app.post('/api/pins/merge', async (req, res) => {
  const { ids } = req.body;
  if (!ids || ids.length < 2) return res.status(400).json({ error: "Need at least 2 pins" });

  const placeholders = ids.map(() => '?').join(',');
  const pins = await all(`SELECT * FROM pins WHERE id IN (${placeholders})`, ids);

  if (pins.length < 2) return res.status(400).json({ error: "Pins not found" });

  // Use the first pin in the list as the "Hero" / Target
  // In a real app, you might sort by creation date or let the user choose
  const targetId = ids[0];
  const targetPin = pins.find(p => p.id === targetId);
  const sourcePins = pins.filter(p => p.id !== targetId);

  if (!targetPin) return res.status(404).json({ error: "Target pin not found" });

  // 1. Gather existing gallery
  let targetGallery: string[] = [];
  try { targetGallery = JSON.parse(targetPin.gallery || '[]'); } catch (e) { }

  // 2. Collect images from source pins
  const sourceImages: string[] = [];
  sourcePins.forEach(p => {
    sourceImages.push(p.imageUrl);
    try {
      const g = JSON.parse(p.gallery || '[]');
      sourceImages.push(...g);
    } catch (e) { }
  });

  // 3. Merge and deduplicate
  const newGallery = Array.from(new Set([...targetGallery, ...sourceImages]));

  // 4. Update Target
  await run("UPDATE pins SET gallery = ? WHERE id = ?", [JSON.stringify(newGallery), targetId]);

  // 5. Delete Sources
  const sourceIds = sourcePins.map(p => p.id);
  if (sourceIds.length > 0) {
    const delPlaceholders = sourceIds.map(() => '?').join(',');
    await run(`DELETE FROM pins WHERE id IN (${delPlaceholders})`, sourceIds);
  }

  res.json({ success: true, mergedPinId: targetId });
});


// --- ROBUST WEB SCRAPER ---
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await response.text();

    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const images = new Set<string>();
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      try {
        const absoluteUrl = new URL(src, url).href;
        if (!absoluteUrl.match(/\.(svg|ico)$/i) && !absoluteUrl.includes('pixel')) {
          images.add(absoluteUrl);
        }
      } catch (e) { }
    }

    const ogRegex = /<meta property="og:image" content="([^">]+)"/g;
    while ((match = ogRegex.exec(html)) !== null) {
      images.add(match[1]);
    }

    res.json({ images: Array.from(images).slice(0, 50) });
  } catch (error: any) {
    console.error("Scrape failed:", error);
    res.status(500).json({ error: "Failed to scrape URL" });
  }
});

app.post('/api/pins/ungroup', async (req, res) => {
  const { id } = req.body;

  // 1. Get the target pin
  const pin = await get("SELECT * FROM pins WHERE id = ?", [id]);
  if (!pin) return res.status(404).json({ error: "Pin not found" });

  const gallery: string[] = JSON.parse(pin.gallery || '[]');

  if (gallery.length === 0) return res.json({ success: true }); // Nothing to ungroup

  // 2. Create new pins for each gallery image
  // We copy the metadata (boards, tags, location) from the parent
  for (const imgUrl of gallery) {
    const newId = uuidv4();
    await run(
      `INSERT INTO pins (id, title, description, imageUrl, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        pin.title,
        pin.description,
        imgUrl,
        '[]', // New pin has no gallery
        pin.boardIds,
        pin.link,
        pin.location,
        1, // Default aspect ratio, or calculate if possible
        pin.tags,
        pin.ownerId,
        Date.now(),
        0
      ]
    );
  }

  // 3. Clear the gallery from the parent pin
  await run("UPDATE pins SET gallery = ? WHERE id = ?", ['[]', id]);

  res.json({ success: true });
});

// --- IMAGE UPLOAD WITH DATE FOLDERS ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const date = new Date();
    const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const targetDir = path.join(IMAGES_DIR, folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const date = new Date();
  const folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  res.json({ url: `/images/${folder}/${req.file.filename}` });
});

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
  let settings = await get("SELECT * FROM settings WHERE id = 'default'");
  res.json(settings || { maxUploadSize: '25MB' });
});
app.post('/api/settings', async (req, res) => {
  await run("UPDATE settings SET maxUploadSize = ? WHERE id = 'default'", [req.body.maxUploadSize]);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));