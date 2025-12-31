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
const NEW_STEMS_ID = 'b-new-stems'; // <--- CONSTANT ID FOR PERMANENT BOARD

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

// --- SELF-HEALING: Ensure Default User & Board Exists ---
const ensureDefaultData = async () => {
    try {
        // 1. Ensure Admin User
        const user = await get("SELECT * FROM users LIMIT 1");
        if (!user) {
            console.log("Creating default Admin user...");
            await run(`
                INSERT INTO users (id, username, email, profileImage, isAdmin, usedQuota, maxQuota, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, ['u1', 'Admin', 'admin@tallo.local', '', 1, '0GB', '5GB', Date.now()]);
        }

        // 2. Ensure 'New Stems' Board
        const board = await get("SELECT * FROM boards WHERE id = ?", [NEW_STEMS_ID]);
        if (!board) {
            console.log("Creating 'New Stems' permanent board...");
            await run(`INSERT INTO boards (id, title, ownerId) VALUES (?, ?, ?)`, [NEW_STEMS_ID, 'New Stems', 'u1']);
        }
    } catch (err) {
        console.error("Failed to check/create default data:", err);
    }
};
ensureDefaultData();


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
app.put('/api/collections/:id', async (req, res) => {
    const { title } = req.body;
    await run("UPDATE collections SET title = ? WHERE id = ?", [title, req.params.id]);
    res.json({ success: true });
});

// --- BOARDS ---
app.get('/api/boards', async (req, res) => {
  // UPDATE: Fetch the user's boards OR the special 'New Stems' board
  const rows = await all(
      "SELECT * FROM boards WHERE ownerId = ? OR id = ?", 
      [req.query.userId, NEW_STEMS_ID]
  );
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

// --- PINS ---
app.get('/api/pins', async (req, res) => {
  const rows = await all("SELECT * FROM pins");
  const pins = rows.map(parsePin);
  res.json(pins);
});

app.post('/api/pins', async (req, res) => {
    const pin = req.body;
    const id = uuidv4();
    
    // SAFETY: If no board selected, force 'New Stems'
    let boardIds = pin.boardIds || [];
    if (boardIds.length === 0) boardIds = [NEW_STEMS_ID];

    await run(
      `INSERT INTO pins (id, title, description, imageUrl, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pin.title, pin.description, pin.imageUrl, JSON.stringify(pin.gallery || []), JSON.stringify(boardIds), pin.link, JSON.stringify(pin.location || null), pin.aspectRatio, JSON.stringify(pin.tags || []), pin.ownerId, Date.now(), 0]
    );
    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.put('/api/pins/:id', async (req, res) => {
    const updates = req.body;
    const id = req.params.id;
    const fields: string[] = [];
    const values: any[] = [];
    
    // SAFETY: If update clears boards, force 'New Stems'
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

  // SAFETY: If update clears boards, force 'New Stems'
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
      let currentBoards: string[] = JSON.parse(row.boardIds || '[]');
      
      // If it was only in 'New Stems', remove 'New Stems' (since it now has a home)
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

// 5. Bulk REMOVE from Board (Fixed Logic)
app.post('/api/pins/bulk-boards-remove', async (req, res) => {
  const { ids, boardId } = req.body;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await all(`SELECT id, boardIds FROM pins WHERE id IN (${placeholders})`, ids);

  for (const row of rows) {
      let currentBoards: string[] = JSON.parse(row.boardIds || '[]');
      if (currentBoards.includes(boardId)) {
          currentBoards = currentBoards.filter(id => id !== boardId);
          
          // SAFETY: If now empty, move to 'New Stems'
          if (currentBoards.length === 0) {
              currentBoards.push(NEW_STEMS_ID);
          }

          await run("UPDATE pins SET boardIds = ? WHERE id = ?", [JSON.stringify(currentBoards), row.id]);
      }
  }
  res.json({ success: true });
});

// 6. MERGE PINS
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
  if (sourceIds.length > 0) {
      const delPlaceholders = sourceIds.map(() => '?').join(',');
      await run(`DELETE FROM pins WHERE id IN (${delPlaceholders})`, sourceIds);
  }

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
        `INSERT INTO pins (id, title, description, imageUrl, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, pin.title, pin.description, imgUrl, '[]', pin.boardIds, pin.link, pin.location, 1, pin.tags, pin.ownerId, Date.now(), 0]
      );
  }
  await run("UPDATE pins SET gallery = ? WHERE id = ?", ['[]', id]);
  res.json({ success: true });
});


// --- ROBUST WEB SCRAPER ---
app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await response.text();
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        
        const images = new Set<string>();
        doc.querySelectorAll('img').forEach((img: any) => {
             if(img.src) {
                 try { images.add(new URL(img.src, url).href); } catch(e){}
             }
        });
        
        res.json({ images: Array.from(images).slice(0, 50) });
    } catch (error: any) {
        console.error("Scrape failed:", error);
        res.status(500).json({ error: "Failed to scrape URL" });
    }
});

// --- IMAGE UPLOAD ---
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