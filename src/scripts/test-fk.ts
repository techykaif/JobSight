import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import crypto from 'crypto';

async function main() {
  console.log('Testing Foreign Key Integrity...');
  try {
    const dummyId = crypto.randomUUID();
    // Insert job without valid company
    await db.insert(schema.jobs).values({
      id: crypto.randomUUID(),
      companyId: dummyId, // Does not exist
      canonicalTitle: 'FK Test Job',
      status: 'ACTIVE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.error('❌ FK constraint failed to trigger. Foreign keys might be disabled!');
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes('FOREIGN KEY constraint failed')) {
      console.log('✅ FK constraint triggered successfully.');
      process.exit(0);
    } else {
      console.error('❌ Unexpected error:', err);
      process.exit(1);
    }
  }
}

main();
