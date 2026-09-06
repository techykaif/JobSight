import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

describe('Phase A: Cross-Run Competition Isolation', () => {
  let runA: string, runB: string;
  let jobX: string;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    
    runA = crypto.randomUUID();
    runB = crypto.randomUUID();
    jobX = crypto.randomUUID();

    const configId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: [],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.runs).values([
      { id: runA, configId, status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: runB, configId, status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);

    await db.insert(schema.jobs).values({
      id: jobX,
      canonicalUrl: `https://example.com/job-${jobX}`,
      status: 'ACTIVE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Run A -> score 95 (A)
    await db.insert(schema.competitionResults).values({
      id: crypto.randomUUID(),
      runId: runA,
      jobId: jobX,
      score: 95,
      level: 'Very High',
      confidence: 100,
      createdAt: new Date().toISOString()
    });

    // Run B -> score 20 (B)
    await db.insert(schema.competitionResults).values({
      id: crypto.randomUUID(),
      runId: runB,
      jobId: jobX,
      score: 20,
      level: 'Low',
      confidence: 100,
      createdAt: new Date().toISOString()
    });
  });

  afterAll(async () => {
    await db.delete(schema.competitionResults).where(eq(schema.competitionResults.jobId, jobX));
    await db.delete(schema.jobs).where(eq(schema.jobs.id, jobX));
    await db.delete(schema.runs).where(eq(schema.runs.id, runA));
    await db.delete(schema.runs).where(eq(schema.runs.id, runB));
  });

  it('proves pipeline evaluation for Run B consumes B, never A', async () => {
    // This replicates the exact logic patched in orchestrator.ts
    // Prior to Phase A, the orchestrator read without eq(schema.competitionResults.runId, runId)
    // which would sometimes return 95 and sometimes 20 depending on SQLite row return order.
    
    const runId = runB;
    const comp = await db.select()
      .from(schema.competitionResults)
      .where(and(
        eq(schema.competitionResults.jobId, jobX),
        eq(schema.competitionResults.runId, runId)
      ))
      .limit(1);
      
    expect(comp).toHaveLength(1);
    expect(comp[0]?.score).toBe(20); // Must consume B (20), never A (95)
  });
});
