import fs from 'fs';
import path from 'path';

function backupDatabase() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const dbPath = path.resolve(dataDir, 'jobsight.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(dataDir, `jobsight-backup-${timestamp}.db`);
  
  fs.copyFileSync(dbPath, backupPath);
  console.log(`Database backed up successfully to: ${backupPath}`);
}

backupDatabase();
