import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// In test environment, use in-memory DB unless specified otherwise
const isTest = process.env.NODE_ENV === 'test';
const dbPath = isTest ? ':memory:' : path.resolve(dataDir, 'jobsight.db');

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency if not in-memory
if (!isTest) {
  sqlite.pragma('journal_mode = WAL');
}
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
