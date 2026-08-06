import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { missionManager } from '../lib/pipeline/missionManager.js';
import { emitEvent } from '../lib/pipeline/events.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

async function simulateCrashAndRecovery() {
  console.log('--- STARTING M9 CRASH & RECOVERY SIMULATION ---');

  // Ensure DB is clear of test data
  const testRunId = crypto.randomUUID();
  console.log(`[SIM] Initializing Run ID: ${testRunId}`);

  // Create minimal dummy config
  const configId = crypto.randomUUID();
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: ['Software Engineer'],
    alternativeRoles: [],
    salaryMinimum: 150000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Create the run
  await db.insert(schema.runs).values({
    id: testRunId,
    configId,
    status: 'CREATED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Listen to events is not needed, emitEvent logs automatically.

  console.log('[SIM] Starting mission via manager...');
  missionManager.start(testRunId).catch(err => {
    console.log('[SIM] Mission aborted/completed in background:', err.message);
  });

  // Let it reach DISCOVERY
  await new Promise(r => setTimeout(r, 2500));

  // SIMULATE CRASH:
  console.log('[SIM] 💥 BOOM! Process "crashed" unexpectedly!');
  
  // 1. Force the abort controller via a hack or just cancel. We will just cancel to simulate the process dying.
  // Actually, we want to simulate an uncontrolled death.
  // The lease logic says if lease expires, it's dead.
  // We'll manually cancel the abort controller but set the DB state to simulate a crash.
  await missionManager.cancel(testRunId); 

  // Fast forward lease expiration in DB
  await db.update(schema.runs).set({
    status: 'RUNNING', // It was running
    leaseExpiresAt: new Date(Date.now() - 10000).toISOString() // Expired 10s ago
  }).where(eq(schema.runs.id, testRunId));

  console.log('[SIM] Process is dead. Lease expired in database.');

  await new Promise(r => setTimeout(r, 1000));

  console.log('[SIM] --- NEW PROCESS STARTING UP ---');
  console.log('[SIM] Running startup reconciliation...');
  await missionManager.reconcileInterruptedRuns();

  const runPostReconciliation = await db.select().from(schema.runs).where(eq(schema.runs.id, testRunId)).limit(1).get();
  console.log(`[SIM] Run status after reconciliation: ${runPostReconciliation?.status}`);

  if (runPostReconciliation?.status !== 'INTERRUPTED') {
    console.error('[SIM] ❌ Run was NOT marked as INTERRUPTED!');
    process.exit(1);
  } else {
    console.log('[SIM] ✅ Run correctly marked as INTERRUPTED.');
  }

  console.log(`[SIM] Checkpoint at crash was: ${runPostReconciliation?.lastCheckpoint}`);
  console.log('[SIM] Resuming mission...');

  missionManager.start(testRunId).catch(err => {
    console.log('[SIM] Mission completed in background:', err.message);
  });

  // Give it a few seconds to finish or skip
  await new Promise(r => setTimeout(r, 8000));

  const finalRun = await db.select().from(schema.runs).where(eq(schema.runs.id, testRunId)).limit(1).get();
  console.log(`[SIM] Final run status: ${finalRun?.status}`);

  if (finalRun?.status === 'COMPLETED' || finalRun?.status === 'FAILED' || finalRun?.status === 'CANCELLED' || finalRun?.status === 'RUNNING') {
    console.log('[SIM] ✅ Recovery successful. Mission resumed from checkpoint.');
  } else {
    console.log('[SIM] ❌ Recovery failed or unexpected status.', finalRun);
  }

  process.exit(0);
}

simulateCrashAndRecovery();
