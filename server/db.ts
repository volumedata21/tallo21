import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'tallo.db'));
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at INTEGER,
    is_admin INTEGER
  );

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
    longitude REAL,
    liked_by TEXT
  );
  
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    created_at INTEGER,
    owner_id TEXT,
    collection_ids TEXT,
    visibility TEXT
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
    created_at INTEGER,
    last_fetched_at INTEGER
  );
`);

export default db;