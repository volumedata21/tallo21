import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const DATA_DIR = process.env.DATA_DIR || './data';
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tallo.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Initialize Tables
db.serialize(() => {
    // Users - UPDATED: Added UNIQUE to username
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT,
        password TEXT, 
        role TEXT,
        usedQuota TEXT,
        maxQuota TEXT,
        avatarSeed TEXT,
        inviteCode TEXT,
        createdAt INTEGER
    )`);

    // Collections
    db.run(`CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        title TEXT,
        ownerId TEXT
    )`);

    // Boards
    db.run(`CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        title TEXT,
        collectionId TEXT,
        ownerId TEXT
    )`);

    // Pins
    db.run(`CREATE TABLE IF NOT EXISTS pins (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        imageUrl TEXT,
        thumbnail TEXT,
        gallery TEXT, 
        boardIds TEXT,
        link TEXT,
        location TEXT,
        aspectRatio REAL,
        tags TEXT,
        ownerId TEXT,
        createdAt INTEGER,
        favorite INTEGER,
        deletedAt INTEGER
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        maxUploadSize TEXT
    )`);
    
    // Insert default settings if not exists
    db.run(`INSERT OR IGNORE INTO settings (id, maxUploadSize) VALUES ('default', '25MB')`);
});

export default db;