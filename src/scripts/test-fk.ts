import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import crypto from 'crypto';

async function main() {
  console.log('Testing Foreign Key Integrity...');
  try {
    const dummyId = crypto.randomUUID();
    const now = new Date().toISOString();
    // Insert job without valid company
    await db.insert(schema.jobs).values([
      {
        id: 'job1',
        companyId: 'comp1',
        remoteType: 'REMOTE',
        status: 'ACTIVE',
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
        canonicalUrl: 'https://example.com/jobs/1'
      }
    ] as any);
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
