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
// @ts-ignore
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 3001;
const NEW_STEMS_ID = 'b-new-stems';

const DATA_DIR = process.env.DATA_DIR || './data';
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// Serve Static Files
app.use('/images', express.static(IMAGES_DIR));
app.use('/thumbnails', express.static(THUMBNAILS_DIR));

// --- SETUP MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } 
});

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

// UPDATED: Parses boardIds from string (New System) AND handles Owner info
const parsePin = (pin: any): Pin => ({
  ...pin,
  gallery: JSON.parse(pin.gallery || '[]'),
  boardIds: typeof pin.boardIds === 'string' && pin.boardIds.startsWith('[') 
    ? JSON.parse(pin.boardIds) 
    : (pin.boardIds ? pin.boardIds.split(',') : []),
  location: pin.location ? JSON.parse(pin.location) : undefined,
  tags: JSON.parse(pin.tags || '[]'),
  favorite: !!pin.favorite,
  deletedAt: pin.deletedAt || undefined,
  thumbnail: pin.thumbnail || undefined,
  ownerName: pin.ownerName,     
  ownerAvatar: pin.ownerAvatar 
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
            { id: 2, name: 'add_thumbnail_to_pins', sql: "ALTER TABLE pins ADD COLUMN thumbnail TEXT DEFAULT NULL" },
            { id: 3, name: 'add_password_to_users', sql: "ALTER TABLE users ADD COLUMN password TEXT DEFAULT NULL" },
            { id: 4, name: 'add_max_users_to_settings', sql: "ALTER TABLE settings ADD COLUMN maxUsers INTEGER DEFAULT 10" },
            { id: 5, name: 'create_invites_table', sql: "CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, code TEXT UNIQUE, assignedQuota TEXT, isUsed INTEGER DEFAULT 0, usedBy TEXT, createdAt INTEGER)" },
            { id: 6, name: 'create_favorites_table', sql: "CREATE TABLE IF NOT EXISTS favorites (userId TEXT, pinId TEXT, createdAt INTEGER, PRIMARY KEY (userId, pinId))" },
            { id: 7, name: 'migrate_legacy_favorites', sql: "INSERT OR IGNORE INTO favorites (userId, pinId, createdAt) SELECT ownerId, id, ? FROM pins WHERE favorite = 1" },
            { id: 8, name: 'create_pin_boards_table', sql: "CREATE TABLE IF NOT EXISTS pin_boards (userId TEXT, pinId TEXT, boardId TEXT, createdAt INTEGER, PRIMARY KEY (userId, pinId, boardId))" },
            // NEW MIGRATION for Board Visibility
            { id: 9, name: 'add_visibility_to_boards', sql: "ALTER TABLE boards ADD COLUMN visibility TEXT DEFAULT 'private'" },
            { id: 10, name: 'add_reset_token_to_users', sql: "ALTER TABLE users ADD COLUMN resetToken TEXT DEFAULT NULL" },
            { id: 11, name: 'add_reset_expiry_to_users', sql: "ALTER TABLE users ADD COLUMN resetTokenExpiresAt INTEGER DEFAULT NULL" }
        ];

        for (const m of migrations) {
            const exists = await get("SELECT * FROM migrations WHERE id = ?", [m.id]);
            if (!exists) {
                console.log(`Applying migration ${m.id}: ${m.name}...`);
                try {
                    if (m.id === 7) await run(m.sql, [Date.now()]);
                    else await run(m.sql);
                    
                    await run("INSERT INTO migrations (id, name, appliedAt) VALUES (?, ?, ?)", [m.id, m.name, Date.now()]);
                } catch (e: any) {
                    if (!e.message.includes('duplicate column')) console.error(`Migration ${m.id} failed:`, e);
                }
            }
        }
    } catch (e) {
        console.error("Migration check failed", e);
    }
};

const ensureDefaultData = async () => {
    try {
        const board = await get("SELECT * FROM boards WHERE id = ?", [NEW_STEMS_ID]);
        if (!board) {
            await run(`INSERT INTO boards (id, title, ownerId, visibility) VALUES (?, ?, ?, ?)`, [NEW_STEMS_ID, 'New Stems', 'u1', 'private']);
        }
    } catch (err) {
        console.error("Default data check failed", err);
    }
};

// --- ROUTES ---

app.get('/', (req, res) => res.send('Tallo API Running'));

// --- AVATAR ROUTES ---
app.get('/api/avatars', async (req, res) => {
    try {
        const files = await fs.promises.readdir(AVATARS_DIR);
        const images = files.filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f));
        res.json(images);
    } catch (e) { res.json([]); }
});

app.get('/api/avatars/image/:filename', (req, res) => {
    const filename = req.params.filename;
    const safeFilename = path.basename(filename);
    const filepath = path.join(AVATARS_DIR, safeFilename);
    if (fs.existsSync(filepath)) res.sendFile(filepath);
    else res.status(404).send('Avatar not found');
});

// --- AUTH & SYSTEM ---

app.get('/api/system/status', async (req, res) => {
    const userCount = await get("SELECT COUNT(*) as count FROM users");
    res.json({ isSetup: userCount.count > 0 });
});

app.post('/api/setup', async (req, res) => {
    const { username, password, email } = req.body;
    const userCount = await get("SELECT COUNT(*) as count FROM users");
    if (userCount.count > 0) return res.status(403).json({ error: "System already set up." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = 'u1'; 
    let randomAvatar = username; 
    try {
        const files = await fs.promises.readdir(AVATARS_DIR);
        const images = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        if (images.length > 0) randomAvatar = images[Math.floor(Math.random() * images.length)];
    } catch (e) {}

    await run(
        `INSERT INTO users (id, username, email, password, role, usedQuota, maxQuota, createdAt, avatarSeed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [id, username, email || null, hashedPassword, 'admin', '0GB', 'Unlimited', Date.now(), randomAvatar]
    );
    const user = await get("SELECT * FROM users WHERE id = ?", [id]);
    res.json(user);
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.password) return res.status(401).json({ error: "Account needs migration" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const { password: _, ...userInfo } = user;
    res.json(userInfo);
});

// Register (Invite Code)
app.post('/api/register', async (req, res) => {
    const { username, password, email, inviteCode } = req.body;
    try {
        const settings = await get("SELECT maxUsers FROM settings WHERE id = 'default'");
        const userCount = await get("SELECT COUNT(*) as count FROM users");
        if (settings && settings.maxUsers && userCount.count >= settings.maxUsers) {
            return res.status(403).json({ error: "User limit reached." });
        }
        const invite = await get("SELECT * FROM invites WHERE code = ? AND isUsed = 0", [inviteCode]);
        if (!invite) return res.status(400).json({ error: "Invalid invite code." });
        
        const existing = await get("SELECT id FROM users WHERE lower(username) = lower(?)", [username]);
        if (existing) return res.status(400).json({ error: "Username taken." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        let randomAvatar = username;
        try {
            const files = await fs.promises.readdir(AVATARS_DIR);
            const images = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
            if (images.length > 0) randomAvatar = images[Math.floor(Math.random() * images.length)];
        } catch (e) {}

        await run(
            `INSERT INTO users (id, username, email, password, role, usedQuota, maxQuota, createdAt, avatarSeed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [id, username, email || null, hashedPassword, 'user', '0GB', invite.assignedQuota || '20GB', Date.now(), randomAvatar]
        );
        await run("UPDATE invites SET isUsed = 1, usedBy = ? WHERE code = ?", [username, inviteCode]);
        const user = await get("SELECT id, username, email, role, avatarSeed FROM users WHERE id = ?", [id]);
        res.json(user);
    } catch (e) { res.status(500).json({ error: "Registration failed" }); }
});

// --- PINS (MULTI-USER + AVATAR JOIN) ---

app.get('/api/pins', async (req, res) => {
  try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      // 1. ADD collectionId to the list of params we read
      const { sort, search, boardId, favorites, tag, creatorId, userId, collectionId } = req.query;

      let sql = `
        SELECT pins.*, 
        users.username as ownerName, 
        users.avatarSeed as ownerAvatar,
        (CASE WHEN f.userId IS NOT NULL THEN 1 ELSE 0 END) as favorite,
        GROUP_CONCAT(pb.boardId) as boardIds
        FROM pins 
        LEFT JOIN users ON pins.ownerId = users.id
        LEFT JOIN favorites f ON pins.id = f.pinId AND f.userId = ?
        LEFT JOIN pin_boards pb ON pins.id = pb.pinId AND pb.userId = ?
        WHERE pins.deletedAt IS NULL
      `;
      
      const params: any[] = [userId || '', userId || '']; 

      if (favorites === 'true') {
          sql += " AND f.userId IS NOT NULL";
      }
      
      if (creatorId) {
          sql += " AND pins.ownerId = ?";
          params.push(creatorId);
      }
      
      if (search) {
          sql += " AND (pins.title LIKE ? OR pins.description LIKE ?)";
          params.push(`%${search}%`, `%${search}%`);
      }

      if (boardId) {
          sql += " AND EXISTS (SELECT 1 FROM pin_boards pb_filter WHERE pb_filter.pinId = pins.id AND pb_filter.boardId = ?)";
          params.push(boardId);
      }

      // 2. ADD THIS NEW BLOCK FOR COLLECTIONS
      // It finds pins that are in ANY board belonging to the collection
      if (collectionId) {
          sql += " AND EXISTS (SELECT 1 FROM pin_boards pb_coll JOIN boards b_coll ON pb_coll.boardId = b_coll.id WHERE pb_coll.pinId = pins.id AND b_coll.collectionId = ?)";
          params.push(collectionId);
      }

      if (tag) {
          sql += " AND pins.tags LIKE ?";
          params.push(`%${tag}%`);
      }
      
      sql += " GROUP BY pins.id";

      let orderBy = 'pins.createdAt DESC'; 
      if (sort === 'oldest') orderBy = 'pins.createdAt ASC';
      else if (sort === 'az') orderBy = 'pins.title ASC';
      else if (sort === 'za') orderBy = 'pins.title DESC';
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

// Toggle Favorite (User Specific)
app.post('/api/pins/toggle-favorite', async (req, res) => {
    const { pinId, userId } = req.body;
    if (!pinId || !userId) return res.status(400).json({ error: "Missing info" });
    try {
        const exists = await get("SELECT * FROM favorites WHERE userId = ? AND pinId = ?", [userId, pinId]);
        if (exists) {
            await run("DELETE FROM favorites WHERE userId = ? AND pinId = ?", [userId, pinId]);
            res.json({ favorited: false });
        } else {
            await run("INSERT INTO favorites (userId, pinId, createdAt) VALUES (?, ?, ?)", [userId, pinId, Date.now()]);
            res.json({ favorited: true });
        }
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/pins', async (req, res) => {
    const pin = req.body;
    const id = uuidv4();
    
    let finalImageUrl = pin.imageUrl;
    let finalThumbnail = pin.thumbnail;

    if (pin.imageUrl && pin.imageUrl.startsWith('http')) {
        const processed = await processExternalImage(pin.imageUrl);
        finalImageUrl = processed.url;
        if (processed.thumbnail) finalThumbnail = processed.thumbnail;
    }

    // 1. Create Pin (Legacy 'boardIds' column kept as empty array [], we rely on pin_boards now)
    await run(
      `INSERT INTO pins (id, title, description, imageUrl, thumbnail, gallery, boardIds, link, location, aspectRatio, tags, ownerId, createdAt, favorite, deletedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, pin.title, pin.description, finalImageUrl, finalThumbnail || null, JSON.stringify(pin.gallery || []), '[]', pin.link, JSON.stringify(pin.location || null), pin.aspectRatio, JSON.stringify(pin.tags || []), pin.ownerId, Date.now(), 0, null]
    );

    // 2. Add to Boards (FIXED: Uses the boards sent from frontend)
    // If frontend sent boards, use them. Otherwise default to NEW_STEMS_ID.
    const boardsToJoin = (pin.boardIds && pin.boardIds.length > 0) ? pin.boardIds : [NEW_STEMS_ID];

    for (const boardId of boardsToJoin) {
         await run(
             "INSERT INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", 
             [pin.ownerId, id, boardId, Date.now()]
         );
    }

    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.put('/api/pins/:id', async (req, res) => {
    const updates = req.body;
    const id = req.params.id;
    const fields: string[] = [];
    const values: any[] = [];
    
    Object.keys(updates).forEach(key => {
        if(key === 'id' || key === 'boardIds' || key === 'favorite') return;
        let val = updates[key];
        if (['gallery', 'tags', 'location'].includes(key)) val = JSON.stringify(val);
        fields.push(`${key} = ?`);
        values.push(val);
    });
    if (fields.length > 0) {
        values.push(id);
        await run(`UPDATE pins SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.delete('/api/pins/:id', async (req, res) => { await run("UPDATE pins SET deletedAt = ? WHERE id = ?", [Date.now(), req.params.id]); res.json({ success: true }); });
app.post('/api/pins/restore', async (req, res) => { await run("UPDATE pins SET deletedAt = NULL WHERE id = ?", [req.body.id]); res.json({ success: true }); });
app.post('/api/pins/bulk-delete', async (req, res) => { const ids = req.body.ids; await run(`UPDATE pins SET deletedAt = ? WHERE id IN (${ids.map(()=>'?').join(',')})`, [Date.now(), ...ids]); res.json({ success: true }); });

// --- BOARD MANAGEMENT (USER SPECIFIC) ---

app.post('/api/pins/bulk-boards', async (req, res) => {
    const { ids, boardId, userId } = req.body; 
    if (!userId) return res.status(400).json({ error: "User ID required" });

    for (const pinId of ids) {
        if (boardId !== NEW_STEMS_ID) {
             await run("DELETE FROM pin_boards WHERE userId = ? AND pinId = ? AND boardId = ?", [userId, pinId, NEW_STEMS_ID]);
        }
        await run("INSERT OR IGNORE INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", [userId, pinId, boardId, Date.now()]);
    }
    res.json({ success: true });
});

app.post('/api/pins/bulk-boards-remove', async (req, res) => {
    const { ids, boardId, userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    for (const pinId of ids) {
        await run("DELETE FROM pin_boards WHERE userId = ? AND pinId = ? AND boardId = ?", [userId, pinId, boardId]);
        const count = await get("SELECT COUNT(*) as c FROM pin_boards WHERE userId = ? AND pinId = ?", [userId, pinId]);
        if (count.c === 0) {
            await run("INSERT INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", [userId, pinId, NEW_STEMS_ID, Date.now()]);
        }
    }
    res.json({ success: true });
});

app.post('/api/pins/bulk-update', async (req, res) => {
    const { ids, updates } = req.body;
    if (!ids || !ids.length) return res.json({ success: false });
    const fields: string[] = [];
    const values: any[] = [];
    Object.keys(updates).forEach(key => {
        let val = updates[key];
        if (['location', 'tags', 'gallery'].includes(key)) val = JSON.stringify(val);
        if (key === 'boardIds') return;
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
      try { const g = JSON.parse(p.gallery || '[]'); sourceImages.push(...g); } catch (e) {}
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
        [newId, pin.title, pin.description, imgUrl, null, '[]', '[]', pin.link, pin.location, 1, pin.tags, pin.ownerId, Date.now(), 0, null]
      );
      await run("INSERT INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", [pin.ownerId, newId, NEW_STEMS_ID, Date.now()]);
  }
  await run("UPDATE pins SET gallery = ? WHERE id = ?", ['[]', id]);
  res.json({ success: true });
});

// --- ADMIN & SETTINGS ---

app.get('/api/users', async (req, res) => { res.json(await all("SELECT id, username, email, role, usedQuota, maxQuota, avatarSeed, inviteCode FROM users")); });
app.get('/api/users/current', async (req, res) => { res.json(await get("SELECT id, username, email, role, avatarSeed FROM users LIMIT 1") || null); });
app.get('/api/users/:id', async (req, res) => {
    const user = await get("SELECT id, username, email, role, avatarSeed FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
});
app.put('/api/users/:id', async (req, res) => {
    const { avatarSeed, email, maxQuota } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (avatarSeed !== undefined) { updates.push("avatarSeed = ?"); values.push(avatarSeed); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (maxQuota !== undefined) { updates.push("maxQuota = ?"); values.push(maxQuota); }
    if (updates.length > 0) { values.push(req.params.id); await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values); }
    res.json(await get("SELECT id, username, email, role, avatarSeed, maxQuota FROM users WHERE id = ?", [req.params.id]));
});
// --- NEW: PASSWORD CHANGE ROUTE ---
app.put('/api/users/:id/password', async (req, res) => {
    const { currentPass, newPass } = req.body;
    const userId = req.params.id;

    if (!currentPass || !newPass) {
        return res.status(400).json({ error: "Missing password fields" });
    }

    try {
        // 1. Get the user's current password hash
        const user = await get("SELECT password FROM users WHERE id = ?", [userId]);
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // 2. Verify current password
        // Note: If user has no password (legacy account), you might want to allow setting it directly
        if (user.password) {
            const match = await bcrypt.compare(currentPass, user.password);
            if (!match) {
                return res.status(401).json({ error: "Current password is incorrect" });
            }
        }

        // 3. Hash new password
        const hashedPassword = await bcrypt.hash(newPass, 10);

        // 4. Update database
        await run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);

        res.json({ success: true });
    } catch (e) {
        console.error("Password update error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});
// --- PASSWORD RESET FLOW ---

// 1. Admin generates a token
app.post('/api/admin/generate-reset-token', async (req, res) => {
    const { userId } = req.body;
    const token = uuidv4() + uuidv4(); 
    
    // 3 hours in milliseconds (3 * 60 * 60 * 1000 = 10800000)
    const expiresAt = Date.now() + 10800000; 

    await run("UPDATE users SET resetToken = ?, resetTokenExpiresAt = ? WHERE id = ?", [token, expiresAt, userId]);
    res.json({ token });
});

// 2. User consumes the token
app.post('/api/auth/complete-reset', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) return res.status(400).json({ error: "Missing fields" });
    
    const user = await get("SELECT * FROM users WHERE resetToken = ?", [token]);
    
    if (!user) {
        return res.status(403).json({ error: "Invalid link" });
    }

    // CHECK EXPIRY
    if (user.resetTokenExpiresAt && Date.now() > user.resetTokenExpiresAt) {
        return res.status(403).json({ error: "Link expired (links are valid for 3 hours)" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    // Clear token and expiry
    await run("UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiresAt = NULL WHERE id = ?", [hashedPassword, user.id]);
    
    res.json({ success: true, username: user.username });
});
app.delete('/api/users/:id', async (req, res) => { if (req.params.id === 'u1') return res.status(403).json({ error: "Root admin" }); await run("DELETE FROM users WHERE id = ?", [req.params.id]); res.json({ success: true }); });

app.get('/api/settings', async (req, res) => { res.json(await get("SELECT * FROM settings WHERE id = 'default'") || { maxUploadSize: '50MB', maxUsers: 10 }); });
app.post('/api/settings', async (req, res) => { await run("UPDATE settings SET maxUploadSize = ?, maxUsers = ? WHERE id = 'default'", [req.body.maxUploadSize, req.body.maxUsers]); res.json({ success: true }); });
app.get('/api/admin/invites', async (req, res) => { res.json(await all("SELECT * FROM invites ORDER BY createdAt DESC")); });
app.post('/api/admin/invites', async (req, res) => { 
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await run("INSERT INTO invites (id, code, assignedQuota, isUsed, createdAt) VALUES (?, ?, ?, 0, ?)", [uuidv4(), code, req.body.quota || '20GB', Date.now()]);
    res.json({ code, assignedQuota: req.body.quota });
});
app.delete('/api/admin/invites/:id', async (req, res) => { await run("DELETE FROM invites WHERE id = ?", [req.params.id]); res.json({ success: true }); });

// --- COLLECTIONS & BOARDS ---
app.get('/api/collections', async (req, res) => { res.json(await all("SELECT * FROM collections WHERE ownerId = ?", [req.query.userId])); });
app.post('/api/collections', async (req, res) => { const id = uuidv4(); await run("INSERT INTO collections (id, title, ownerId) VALUES (?, ?, ?)", [id, req.body.title, req.body.ownerId]); res.json(await get("SELECT * FROM collections WHERE id = ?", [id])); });
app.delete('/api/collections/:id', async (req, res) => { await run("DELETE FROM collections WHERE id = ?", [req.params.id]); res.json({ success: true }); });

// --- UPDATED BOARD ROUTES (VISIBILITY) ---
app.get('/api/boards', async (req, res) => { 
    // Get all boards owned by user OR the system New Stems board
    res.json(await all("SELECT * FROM boards WHERE ownerId = ? OR id = ?", [req.query.userId, NEW_STEMS_ID])); 
});

// NEW: Get Single Board (for sharing)
app.get('/api/boards/:id', async (req, res) => {
    const board = await get("SELECT * FROM boards WHERE id = ?", [req.params.id]);
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.json(board);
});

// CREATE Board with Visibility
app.post('/api/boards', async (req, res) => { 
    const id = uuidv4(); 
    const visibility = req.body.visibility || 'private';
    await run(
        "INSERT INTO boards (id, title, collectionId, ownerId, visibility) VALUES (?, ?, ?, ?, ?)", 
        [id, req.body.title, req.body.collectionId, req.body.ownerId, visibility]
    ); 
    res.json(await get("SELECT * FROM boards WHERE id = ?", [id])); 
});

app.delete('/api/boards/:id', async (req, res) => { await run("DELETE FROM boards WHERE id = ?", [req.params.id]); res.json({ success: true }); });

// UPDATE Board with Visibility
app.put('/api/boards/:id', async (req, res) => {
    if (req.body.title !== undefined) await run("UPDATE boards SET title = ? WHERE id = ?", [req.body.title, req.params.id]);
    if (req.body.collectionId !== undefined) await run("UPDATE boards SET collectionId = ? WHERE id = ?", [req.body.collectionId, req.params.id]);
    if (req.body.visibility !== undefined) await run("UPDATE boards SET visibility = ? WHERE id = ?", [req.body.visibility, req.params.id]);
    res.json({success: true});
});

// --- UPLOAD & SCRAPE ---

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

app.post('/api/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        console.log(`Scraping: ${url}`);
        const extractedImages = new Set<string>();
        let scrapedTitle = '';

        // 1. Try noembed (YouTube, Vimeo, etc)
        try {
            const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const oembedRes = await fetch(oembedUrl);
            const oembedData = await oembedRes.json();
            
            if (oembedData.title) scrapedTitle = oembedData.title;
            if (oembedData.thumbnail_url) extractedImages.add(oembedData.thumbnail_url);
        } catch (e) {
            console.warn("oEmbed failed, falling back to standard scraper");
        }

        // 2. Standard Scrape
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

// --- SERVER STARTUP ---
const startServer = async () => {
    // 1. Run migrations first
    await runMigrations();
    // 2. Ensure default data
    await ensureDefaultData();
    // 3. Start listening
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
};

startServer();