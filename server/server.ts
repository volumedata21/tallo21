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
// Use Environment Port if available, default to 3001
const PORT = parseInt(process.env.PORT || '3001');
const NEW_STEMS_ID = 'b-new-stems';

const DATA_DIR = process.env.DATA_DIR || './data';
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

// Enhanced CORS Configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token', 'x-user-id']
}));

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

const parseBytes = (sizeStr: string): number => {
    if (!sizeStr || sizeStr === 'Unlimited') return Infinity;
    const units: { [key: string]: number } = { 'B': 1, 'KB': 1024, 'MB': 1024 ** 2, 'GB': 1024 ** 3, 'TB': 1024 ** 4 };
    const match = sizeStr.match(/^(\d+(\.\d+)?)\s*([a-zA-Z]+)$/);
    if (!match) return 0;
    const val = parseFloat(match[1]);
    const unit = match[3].toUpperCase().replace(/S$/, '');
    const multiplier = units[unit] || units[unit[0]] || 1;
    return val * multiplier;
};

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const updateUserQuota = async (userId: string) => {
    try {
        const pins = await all("SELECT imageUrl, thumbnail, gallery FROM pins WHERE ownerId = ? AND deletedAt IS NULL", [userId]);
        let totalBytes = 0;
        const processedFiles = new Set<string>();

        const addFile = (url: string) => {
            if (!url || processedFiles.has(url)) return;
            processedFiles.add(url);

            let filePath = '';
            if (url.startsWith('/images/')) {
                filePath = path.join(IMAGES_DIR, url.replace('/images/', ''));
            } else if (url.startsWith('/thumbnails/')) {
                filePath = path.join(THUMBNAILS_DIR, url.replace('/thumbnails/', ''));
            }

            if (filePath && fs.existsSync(filePath)) {
                totalBytes += fs.statSync(filePath).size;
            }
        };

        for (const pin of pins) {
            addFile(pin.imageUrl);
            addFile(pin.thumbnail);
            if (pin.gallery) {
                try {
                    const g = JSON.parse(pin.gallery);
                    if (Array.isArray(g)) g.forEach(addFile);
                } catch {}
            }
        }

        const quotaStr = formatBytes(totalBytes);
        await run("UPDATE users SET usedQuota = ? WHERE id = ?", [quotaStr, userId]);
        return quotaStr;
    } catch (e) {
        console.error("Quota update failed:", e);
    }
};

// --- AUTH MIDDLEWARE ---
const requireAuth = async (req: any, res: any, next: any) => {
    const apiToken = req.headers['x-api-token'];
    if (apiToken) {
        const user = await get("SELECT * FROM users WHERE apiToken = ?", [apiToken]);
        if (user) {
            req.user = user;
            return next();
        }
    }

    const userId = req.headers['x-user-id'];
    if (userId) {
        const user = await get("SELECT * FROM users WHERE id = ?", [userId]);
        if (user) {
            req.user = user;
            return next();
        }
    }

    console.log(`Blocked unauthorized request to ${req.path}`);
    res.status(401).json({ error: "Unauthorized" });
};

// --- MIDDLEWARE: GATEKEEPER ---
const gatekeeper = async (req: any, res: any, next: any) => {
    const apiToken = req.headers['x-api-token'];
    const userId = req.headers['x-user-id'];
    let user = null;

    if (apiToken) user = await get("SELECT * FROM users WHERE apiToken = ?", [apiToken]);
    else if (userId) user = await get("SELECT * FROM users WHERE id = ?", [userId]);

    if (user) {
        req.user = user;
        return next();
    }

    const settings = await get("SELECT isServerOpen FROM settings WHERE id = 'default'");
    const isOpen = settings ? settings.isServerOpen === 1 : true;

    if (!isOpen) {
        return res.status(401).json({ error: "Server is closed to the public. Please log in." });
    }

    next();
};

const parsePin = (pin: any): Pin => {
    const activeBoardIds = pin.realBoardIds || pin.boardIds;
    return {
        ...pin,
        gallery: JSON.parse(pin.gallery || '[]'),
        boardIds: typeof activeBoardIds === 'string' && activeBoardIds.startsWith('[')
            ? JSON.parse(activeBoardIds)
            : (activeBoardIds ? activeBoardIds.split(',') : []),
        location: pin.location ? JSON.parse(pin.location) : undefined,
        tags: JSON.parse(pin.tags || '[]'),
        favorite: !!pin.favorite,
        deletedAt: pin.deletedAt || undefined,
        thumbnail: pin.thumbnail || undefined,
        ownerName: pin.ownerName,
        ownerAvatar: pin.ownerAvatar
    };
};

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
            return { url: `/images/${folder}/${filename}`, thumbnail: null };
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

// --- MIGRATION SYSTEM (UPDATED) ---
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
            { id: 9, name: 'add_visibility_to_boards', sql: "ALTER TABLE boards ADD COLUMN visibility TEXT DEFAULT 'private'" },
            { id: 10, name: 'add_reset_token_to_users', sql: "ALTER TABLE users ADD COLUMN resetToken TEXT DEFAULT NULL" },
            { id: 11, name: 'add_reset_expiry_to_users', sql: "ALTER TABLE users ADD COLUMN resetTokenExpiresAt INTEGER DEFAULT NULL" },
            { id: 12, name: 'add_api_token_to_users', sql: "ALTER TABLE users ADD COLUMN apiToken TEXT DEFAULT NULL" },
            { id: 13, name: 'add_server_open_setting', sql: "ALTER TABLE settings ADD COLUMN isServerOpen INTEGER DEFAULT 1" },
            { id: 14, name: 'add_unlisted_visibility', sql: "UPDATE boards SET visibility = 'private' WHERE visibility IS NULL" },
            { id: 15, name: 'add_home_page_pref', sql: "ALTER TABLE users ADD COLUMN homePagePreference TEXT DEFAULT 'all'" }
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

        // FORCE CHECK: Ensure 'isServerOpen' column actually exists in settings table
        // This fixes the issue where the migration might be skipped but column is missing
        const columns = await all("PRAGMA table_info(settings)");
        const hasColumn = columns.some(c => c.name === 'isServerOpen');
        if (!hasColumn) {
            console.log("Forcing creation of missing column: isServerOpen");
            await run("ALTER TABLE settings ADD COLUMN isServerOpen INTEGER DEFAULT 1");
        }

    } catch (e) { console.error("Migration check failed", e); }
};

const ensureDefaultData = async () => {
    try {
        const board = await get("SELECT * FROM boards WHERE id = ?", [NEW_STEMS_ID]);
        if (!board) {
            await run(`INSERT INTO boards (id, title, ownerId, visibility) VALUES (?, ?, ?, ?)`, [NEW_STEMS_ID, 'New Stems', 'u1', 'private']);
        }
    } catch (err) { console.error("Default data check failed", err); }
};

// --- ROUTES ---

app.get('/', (req, res) => res.send('Tallo API Running'));

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
    const settings = await get("SELECT isServerOpen FROM settings WHERE id = 'default'");
    const isServerOpen = settings ? settings.isServerOpen === 1 : true;

    res.json({ 
        isSetup: userCount.count > 0,
        isServerOpen: isServerOpen 
    });
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
    } catch (e) { }

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
    await updateUserQuota(user.id);
    res.json(userInfo);
});

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
        } catch (e) { }

        await run(
            `INSERT INTO users (id, username, email, password, role, usedQuota, maxQuota, createdAt, avatarSeed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, username, email || null, hashedPassword, 'user', '0GB', invite.assignedQuota || '20GB', Date.now(), randomAvatar]
        );
        await run("UPDATE invites SET isUsed = 1, usedBy = ? WHERE code = ?", [username, inviteCode]);
        const user = await get("SELECT id, username, email, role, avatarSeed FROM users WHERE id = ?", [id]);
        res.json(user);
    } catch (e) { res.status(500).json({ error: "Registration failed" }); }
});

app.get('/api/pins', gatekeeper, async (req: any, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const { sort, search, boardId, favorites, tag, creatorId, collectionId } = req.query;
        const currentUserId = req.user ? req.user.id : null;

        let sql = `
        SELECT pins.*, 
        users.username as ownerName, 
        users.avatarSeed as ownerAvatar,
        (CASE WHEN f.userId IS NOT NULL THEN 1 ELSE 0 END) as favorite,
        GROUP_CONCAT(pb_all.boardId) as realBoardIds
        FROM pins 
        LEFT JOIN users ON pins.ownerId = users.id
        LEFT JOIN favorites f ON pins.id = f.pinId AND f.userId = ?
        LEFT JOIN pin_boards pb_all ON pins.id = pb_all.pinId
      `;

        const params: any[] = [currentUserId || ''];
        const conditions: string[] = ["pins.deletedAt IS NULL"];

        if (boardId) {
            const board = await get("SELECT * FROM boards WHERE id = ?", [boardId]);
            if (!board) return res.json([]);

            const canView = (board.visibility !== 'private') || (board.ownerId === currentUserId);
            if (!canView) return res.status(403).json({ error: "Private board" });

            sql += ` JOIN pin_boards pb ON pins.id = pb.pinId `;
            conditions.push("pb.boardId = ?");
            params.push(boardId);

        } else if (favorites === 'true' && currentUserId) {
            conditions.push("f.userId IS NOT NULL");

        } else if (creatorId) {
            conditions.push("pins.ownerId = ?");
            params.push(creatorId);

            if (creatorId !== currentUserId) {
                conditions.push(`EXISTS (
                SELECT 1 FROM pin_boards pb 
                JOIN boards b ON pb.boardId = b.id 
                WHERE pb.pinId = pins.id AND b.visibility = 'public'
             )`);
            }

        } else {
            conditions.push(`EXISTS (
                SELECT 1 FROM pin_boards pb 
                JOIN boards b ON pb.boardId = b.id 
                WHERE pb.pinId = pins.id AND b.visibility = 'public'
            )`);
        }

        if (search) {
            const searchTerm = search.toString();
            if (searchTerm.startsWith('#')) {
                const tagOnly = searchTerm.slice(1);
                conditions.push("pins.tags LIKE ?");
                params.push(`%${tagOnly}%`);
            } else {
                conditions.push("(pins.title LIKE ? OR pins.description LIKE ? OR pins.tags LIKE ?)");
                params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
            }
        }

        if (tag) {
             conditions.push("pins.tags LIKE ?");
             params.push(`%${tag}%`);
        }

        if (conditions.length > 0) {
            sql += " WHERE " + conditions.join(" AND ");
        }

        sql += " GROUP BY pins.id";

        let orderBy = 'pins.createdAt DESC';
        if (sort === 'oldest') orderBy = 'pins.createdAt ASC';
        else if (sort === 'az') orderBy = 'pins.title ASC';
        else if (sort === 'za') orderBy = 'pins.title DESC';
        else if (sort === 'random') orderBy = 'RANDOM()';

        sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = await all(sql, params);
        res.json(rows.map(parsePin));
    } catch (e) {
        console.error("Fetch pins error:", e);
        res.status(500).json({ error: "Failed to fetch pins" });
    }
});

app.post('/api/pins/toggle-favorite', requireAuth, async (req, res) => {
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

app.post('/api/pins', requireAuth, async (req: any, res: any) => {
    const pin = req.body;
    const id = uuidv4();
    const ownerId = req.user.id;

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
        [id, pin.title, pin.description, finalImageUrl, finalThumbnail || null, JSON.stringify(pin.gallery || []), '[]', pin.link, JSON.stringify(pin.location || null), pin.aspectRatio, JSON.stringify(pin.tags || []),
            ownerId, // Force ownerId
            Date.now(), 0, null]
    );

    const boardsToJoin = (pin.boardIds && pin.boardIds.length > 0) ? pin.boardIds : [NEW_STEMS_ID];
    for (const boardId of boardsToJoin) {
        await run("INSERT INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", [ownerId, id, boardId, Date.now()]);
    }
    await updateUserQuota(ownerId);
    
    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.put('/api/pins/:id', requireAuth, async (req, res) => {
    const updates = req.body;
    const id = req.params.id;
    const fields: string[] = [];
    const values: any[] = [];
    Object.keys(updates).forEach(key => {
        if (key === 'id' || key === 'boardIds' || key === 'favorite') return;
        let val = updates[key];
        if (['gallery', 'tags', 'location'].includes(key)) val = JSON.stringify(val);
        fields.push(`${key} = ?`);
        values.push(val);
    });
    if (fields.length > 0) {
        values.push(id);
        await run(`UPDATE pins SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    
    const pinCheck = await get("SELECT ownerId FROM pins WHERE id = ?", [id]);
    if(pinCheck) await updateUserQuota(pinCheck.ownerId);

    res.json(parsePin(await get("SELECT * FROM pins WHERE id = ?", [id])));
});

app.delete('/api/pins/:id', requireAuth, async (req: any, res: any) => {
    const pin = await get("SELECT ownerId FROM pins WHERE id = ?", [req.params.id]);
    if (!pin) return res.status(404).json({ error: "Pin not found" });

    if (req.user.role !== 'admin' && pin.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: You do not own this pin" });
    }

    await run("UPDATE pins SET deletedAt = ? WHERE id = ?", [Date.now(), req.params.id]);
    await updateUserQuota(pin.ownerId);
    res.json({ success: true });
});

app.post('/api/pins/restore', requireAuth, async (req: any, res) => { 
    await run("UPDATE pins SET deletedAt = NULL WHERE id = ?", [req.body.id]); 
    await updateUserQuota(req.user.id);
    res.json({ success: true }); 
});

app.post('/api/pins/bulk-delete', requireAuth, async (req: any, res) => { 
    const ids = req.body.ids; 
    await run(`UPDATE pins SET deletedAt = ? WHERE id IN (${ids.map(() => '?').join(',')})`, [Date.now(), ...ids]); 
    await updateUserQuota(req.user.id);
    res.json({ success: true }); 
});

app.get('/api/users/:id/public', gatekeeper, async (req: any, res) => {
    try {
        const user = await get("SELECT id, username, avatarSeed, role, createdAt FROM users WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "User not found" });

        const pinCount = await get("SELECT COUNT(*) as c FROM pins WHERE ownerId = ? AND deletedAt IS NULL", [req.params.id]);

        res.json({
            id: user.id,
            username: user.username,
            avatarSeed: user.avatarSeed,
            role: user.role,
            joinedAt: user.createdAt,
            stats: {
                pins: pinCount.c
            }
        });
    } catch (e) {
        res.status(500).json({ error: "Profile fetch failed" });
    }
});

app.post('/api/pins/bulk-boards', requireAuth, async (req, res) => {
    const { ids, boardId, userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    for (const pinId of ids) {
        if (boardId !== NEW_STEMS_ID) await run("DELETE FROM pin_boards WHERE userId = ? AND pinId = ? AND boardId = ?", [userId, pinId, NEW_STEMS_ID]);
        await run("INSERT OR IGNORE INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", [userId, pinId, boardId, Date.now()]);
    }
    res.json({ success: true });
});

app.post('/api/pins/bulk-boards-remove', requireAuth, async (req, res) => {
    const { ids, boardId, userId } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID required" });
    for (const pinId of ids) {
        await run("DELETE FROM pin_boards WHERE userId = ? AND pinId = ? AND boardId = ?", [userId, pinId, boardId]);
        const count = await get("SELECT COUNT(*) as c FROM pin_boards WHERE userId = ? AND pinId = ?", [userId, pinId]);
        if (count.c === 0) await run("INSERT INTO pin_boards (userId, pinId, boardId, createdAt) VALUES (?, ?, ?, ?)", [userId, pinId, NEW_STEMS_ID, Date.now()]);
    }
    res.json({ success: true });
});

app.post('/api/pins/bulk-update', requireAuth, async (req, res) => {
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
    await run(`UPDATE pins SET ${fields.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`, values);
    res.json({ success: true });
});

app.post('/api/pins/bulk-tags', requireAuth, async (req, res) => {
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

app.post('/api/pins/merge', requireAuth, async (req: any, res) => {
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
    try { targetGallery = JSON.parse(targetPin.gallery || '[]'); } catch (e) { }
    const sourceImages: string[] = [];
    sourcePins.forEach(p => {
        sourceImages.push(p.imageUrl);
        try { const g = JSON.parse(p.gallery || '[]'); sourceImages.push(...g); } catch (e) { }
    });
    const newGallery = Array.from(new Set([...targetGallery, ...sourceImages]));
    await run("UPDATE pins SET gallery = ? WHERE id = ?", [JSON.stringify(newGallery), targetId]);
    const sourceIds = sourcePins.map(p => p.id);
    await run(`UPDATE pins SET deletedAt = ? WHERE id IN (${sourceIds.map(() => '?').join(',')})`, [Date.now(), ...sourceIds]);
    
    await updateUserQuota(req.user.id);

    res.json({ success: true, mergedPinId: targetId });
});

app.post('/api/pins/ungroup', requireAuth, async (req: any, res) => {
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
    
    await updateUserQuota(req.user.id);

    res.json({ success: true });
});

app.get('/api/users', requireAuth, async (req, res) => { res.json(await all("SELECT id, username, email, role, usedQuota, maxQuota, avatarSeed, inviteCode, homePagePreference FROM users")); });

app.get('/api/users/current', async (req, res) => {
    res.json(await get("SELECT id, username, email, role, avatarSeed, homePagePreference FROM users LIMIT 1") || null);
});

app.get('/api/users/:id', async (req, res) => {
    const user = await get("SELECT id, username, email, role, avatarSeed, homePagePreference FROM users WHERE id = ?", [req.params.id]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
});

app.put('/api/users/:id', requireAuth, async (req, res) => {
    const { avatarSeed, email, maxQuota, homePagePreference } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (avatarSeed !== undefined) { updates.push("avatarSeed = ?"); values.push(avatarSeed); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (maxQuota !== undefined) { updates.push("maxQuota = ?"); values.push(maxQuota); }
    if (homePagePreference !== undefined) { updates.push("homePagePreference = ?"); values.push(homePagePreference); }

    if (updates.length > 0) {
        values.push(req.params.id);
        await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json(await get("SELECT id, username, email, role, avatarSeed, maxQuota, homePagePreference FROM users WHERE id = ?", [req.params.id]));
});

app.put('/api/users/:id/password', requireAuth, async (req, res) => {
    const { currentPass, newPass } = req.body;
    if (!currentPass || !newPass) return res.status(400).json({ error: "Missing password fields" });
    try {
        const user = await get("SELECT password FROM users WHERE id = ?", [req.params.id]);
        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.password) {
            const match = await bcrypt.compare(currentPass, user.password);
            if (!match) return res.status(401).json({ error: "Current password is incorrect" });
        }
        const hashedPassword = await bcrypt.hash(newPass, 10);
        await run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Internal server error" }); }
});

app.post('/api/users/:id/token', requireAuth, async (req, res) => {
    const userId = req.params.id;
    const token = 'sk_' + uuidv4().replace(/-/g, '');
    await run("UPDATE users SET apiToken = ? WHERE id = ?", [token, userId]);
    res.json({ token });
});

app.post('/api/admin/generate-reset-token', requireAuth, async (req, res) => {
    const { userId } = req.body;
    const token = uuidv4() + uuidv4();
    const expiresAt = Date.now() + 10800000;
    await run("UPDATE users SET resetToken = ?, resetTokenExpiresAt = ? WHERE id = ?", [token, expiresAt, userId]);
    res.json({ token });
});

app.post('/api/auth/complete-reset', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Missing fields" });
    const user = await get("SELECT * FROM users WHERE resetToken = ?", [token]);
    if (!user) return res.status(403).json({ error: "Invalid link" });
    if (user.resetTokenExpiresAt && Date.now() > user.resetTokenExpiresAt) return res.status(403).json({ error: "Link expired" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await run("UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiresAt = NULL WHERE id = ?", [hashedPassword, user.id]);
    res.json({ success: true, username: user.username });
});

app.delete('/api/users/:id', requireAuth, async (req, res) => {
    if (req.params.id === 'u1') return res.status(403).json({ error: "Root admin" });
    await run("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

app.get('/api/settings', requireAuth, async (req, res) => { res.json(await get("SELECT * FROM settings WHERE id = 'default'") || { maxUploadSize: '50MB', maxUsers: 10 }); });

// FIX: Added try/catch to debug errors
app.post('/api/settings', requireAuth, async (req, res) => { 
    try {
        const isOpen = req.body.isServerOpen ? 1 : 0;
        await run("UPDATE settings SET maxUploadSize = ?, maxUsers = ?, isServerOpen = ? WHERE id = 'default'", 
            [req.body.maxUploadSize, req.body.maxUsers, isOpen]
        ); 
        res.json({ success: true }); 
    } catch (e: any) {
        console.error("Settings Update Failed:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/invites', requireAuth, async (req, res) => { res.json(await all("SELECT * FROM invites ORDER BY createdAt DESC")); });
app.post('/api/admin/invites', requireAuth, async (req, res) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await run("INSERT INTO invites (id, code, assignedQuota, isUsed, createdAt) VALUES (?, ?, ?, 0, ?)", [uuidv4(), code, req.body.quota || '20GB', Date.now()]);
    res.json({ code, assignedQuota: req.body.quota });
});
app.delete('/api/admin/invites/:id', requireAuth, async (req, res) => { await run("DELETE FROM invites WHERE id = ?", [req.params.id]); res.json({ success: true }); });

app.get('/api/collections', async (req, res) => { res.json(await all("SELECT * FROM collections WHERE ownerId = ?", [req.query.userId])); });
app.post('/api/collections', requireAuth, async (req, res) => { const id = uuidv4(); await run("INSERT INTO collections (id, title, ownerId) VALUES (?, ?, ?)", [id, req.body.title, req.body.ownerId]); res.json(await get("SELECT * FROM collections WHERE id = ?", [id])); });
app.delete('/api/collections/:id', requireAuth, async (req, res) => { await run("DELETE FROM collections WHERE id = ?", [req.params.id]); res.json({ success: true }); });
app.put('/api/collections/:id', requireAuth, async (req, res) => {
    if (req.body.title !== undefined) await run("UPDATE collections SET title = ? WHERE id = ?", [req.body.title, req.params.id]);
    res.json({ success: true });
});

app.get('/api/boards', gatekeeper, async (req: any, res) => {
    const currentUserId = req.user ? req.user.id : null;
    const targetOwnerId = req.query.userId || req.query.ownerId || currentUserId;

    const coverImageSql = `
        (SELECT p.imageUrl 
         FROM pins p 
         JOIN pin_boards pb ON p.id = pb.pinId 
         WHERE pb.boardId = b.id AND p.deletedAt IS NULL 
         ORDER BY p.createdAt DESC LIMIT 1) as coverImage
    `;

    if (currentUserId && targetOwnerId === currentUserId) {
        const sql = `SELECT b.*, ${coverImageSql} FROM boards b WHERE ownerId = ? OR id = ?`;
        return res.json(await all(sql, [currentUserId, NEW_STEMS_ID]));
    }

    if (targetOwnerId) {
        const sql = `SELECT b.*, ${coverImageSql} FROM boards b WHERE ownerId = ? AND visibility = 'public'`;
        return res.json(await all(sql, [targetOwnerId]));
    }

    res.json([]);
});

app.post('/api/boards', requireAuth, async (req: any, res) => {
    const id = uuidv4();
    const ownerId = req.user.id;

    await run("INSERT INTO boards (id, title, collectionId, ownerId, visibility) VALUES (?, ?, ?, ?, ?)",
        [id, req.body.title, req.body.collectionId, ownerId, req.body.visibility || 'private']
    );
    res.json(await get("SELECT * FROM boards WHERE id = ?", [id]));
});

app.delete('/api/boards/:id', requireAuth, async (req, res) => { await run("DELETE FROM boards WHERE id = ?", [req.params.id]); res.json({ success: true }); });
app.put('/api/boards/:id', requireAuth, async (req, res) => {
    if (req.body.title !== undefined) await run("UPDATE boards SET title = ? WHERE id = ?", [req.body.title, req.params.id]);
    if (req.body.collectionId !== undefined) await run("UPDATE boards SET collectionId = ? WHERE id = ?", [req.body.collectionId, req.params.id]);
    if (req.body.visibility !== undefined) await run("UPDATE boards SET visibility = ? WHERE id = ?", [req.body.visibility, req.params.id]);
    res.json({ success: true });
});

app.post('/api/upload', requireAuth, upload.single('file'), async (req: any, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const used = parseBytes(req.user.usedQuota);
    const max = parseBytes(req.user.maxQuota);
    const incoming = req.file.size;

    if (used + incoming > max) {
        return res.status(403).json({ error: "Storage quota exceeded." });
    }
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
    if (isVideo) thumbFilename = filename;

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

app.post('/api/scrape', requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL required' });

        console.log(`Scraping: ${url}`);
        const extractedImages = new Set<string>();
        let scrapedTitle = '';

        try {
            const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
            const oembedData = await oembedRes.json();
            if (oembedData.title) scrapedTitle = oembedData.title;
            if (oembedData.thumbnail_url) extractedImages.add(oembedData.thumbnail_url);
        } catch (e) {
            console.warn("oEmbed failed");
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

            ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'link[rel="image_src"]'].forEach(selector => {
                doc.querySelectorAll(selector).forEach((el: any) => {
                    const content = el.getAttribute('content') || el.getAttribute('href');
                    if (content) try { extractedImages.add(new URL(content, url).href); } catch (e) { }
                });
            });

            doc.querySelectorAll('img').forEach((img: any) => {
                const candidateSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src;
                if (candidateSrc && !candidateSrc.startsWith('data:')) {
                    try {
                        const width = img.getAttribute('width');
                        if (width && parseInt(width) < 50) return;
                        extractedImages.add(new URL(candidateSrc, url).href);
                    } catch (e) { }
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

app.post('/api/admin/regenerate-thumbnails', requireAuth, async (req, res) => {
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
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
};

const FRONTEND_PATH = path.join(__dirname, 'public_html');

if (fs.existsSync(FRONTEND_PATH)) {
    // Serve static assets (JS, CSS) from the React build
    app.use(express.static(FRONTEND_PATH));

    // Handle React Routing (SPA Fallback)
    // If a request comes in that isn't an API call or an image, send the React index.html
    app.get('*', (req: any, res: any) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/images') || req.path.startsWith('/thumbnails')) {
            return res.status(404).json({ error: "Not found" });
        }
        res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
    });
} else {
    console.log("Running in API-only mode (No frontend found at " + FRONTEND_PATH + ")");
}

// --- SERVER STARTUP ---
const startServer = async () => {
    // 1. Run migrations first
    await runMigrations();
    // 2. Ensure default data
    await ensureDefaultData();
    // 3. Start listening
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
};

startServer();