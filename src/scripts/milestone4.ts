import crypto from 'crypto';
import { runIngestionPipeline } from '../lib/pipeline/ingestion.js';
import * as repos from '../lib/db/repositories/index.js';
import { M4HuntFixture } from '../fixtures/m4-hunt.js';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('──────────────');
  console.log('JOBSight — M4 Ingestion');
  console.log('──────────────\n');

  const configId = crypto.randomUUID();
  const runId = crypto.randomUUID();

  // 1. Save Hunt Config
  await repos.saveHuntConfig({
    id: configId,
    targetRoles: JSON.stringify(M4HuntFixture.targetRoles),
    alternativeRoles: JSON.stringify([]),
    remoteRequirement: M4HuntFixture.remoteRequirement,
    experiencePreferences: JSON.stringify(M4HuntFixture.experiencePreferences),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 2. Create Run
  await repos.createRun({
    id: runId,
    configId,
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log(`[RUN] Created run ${runId} with config ${configId}`);

  // 3. Execute Pipeline
  const stats = await runIngestionPipeline(runId, M4HuntFixture);

  // 4. Update Run Status
  await db.update(schema.runs)
    .set({ status: 'COMPLETED', completedAt: new Date().toISOString() })
    .where(eq(schema.runs.id, runId));

  console.log('\n──────────────');
  console.log('RUN COMPLETE');
  console.log(`Discovered: ${stats.discovered}`);
  console.log(`Structured: ${stats.structured}`);
  console.log(`Valid: ${stats.valid}`);
  console.log(`Persisted: ${stats.persisted}`);
  console.log(`Failed: ${stats.failed}`);
  console.log('Database: data/jobsight.db');
  console.log('──────────────\n');

}

main().catch(console.error);
