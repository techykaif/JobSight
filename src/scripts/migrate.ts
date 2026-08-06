import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';

function runMigrations() {
  const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'jobsight.db');
  console.log(`Running migrations against ${dbPath}...`);
  
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  
  console.log('Migrations completed successfully.');
  sqlite.close();
}

runMigrations();
