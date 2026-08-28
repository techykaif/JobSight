import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

describe('Dashboard and Board Integration', () => {
  const runId = crypto.randomUUID();
  const oldRunId = crypto.randomUUID();
  const jobId1 = crypto.randomUUID(); // APPLY
  const jobId2 = crypto.randomUUID(); // REVIEW
  const jobId3 = crypto.randomUUID(); // Old APPLY
  const configId = crypto.randomUUID();

  beforeAll(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });

    await db.insert(schema.huntConfigs).values([
      { id: configId, targetRoles: '[]', alternativeRoles: '[]', createdAt: '2020-01-01', updatedAt: '2020-01-01' }
    ]);

    await db.insert(schema.runs).values([
      { id: oldRunId, configId, profileSnapshot: '{}', status: 'COMPLETED', createdAt: '2020-01-01', updatedAt: '2020-01-01' },
      { id: runId, configId, profileSnapshot: '{}', status: 'COMPLETED', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
    ]);
    
    await db.insert(schema.jobs).values([
      { id: jobId1, canonicalTitle: 'Job 1', canonicalUrl: 'http://1', companyId: null, createdAt: '2020-01-01', updatedAt: '2020-01-01', firstSeenAt: '2020-01-01', lastSeenAt: '2020-01-01', status: 'ACTIVE' },
      { id: jobId2, canonicalTitle: 'Job 2', canonicalUrl: 'http://2', companyId: null, createdAt: '2020-01-01', updatedAt: '2020-01-01', firstSeenAt: '2020-01-01', lastSeenAt: '2020-01-01', status: 'ACTIVE' },
      { id: jobId3, canonicalTitle: 'Job 3', canonicalUrl: 'http://3', companyId: null, createdAt: '2020-01-01', updatedAt: '2020-01-01', firstSeenAt: '2020-01-01', lastSeenAt: '2020-01-01', status: 'ACTIVE' }
    ]);

    await db.insert(schema.candidateDecisions).values([
      { id: crypto.randomUUID(), runId: runId, jobId: jobId1, finalDecision: 'APPLY', primaryReason: 'test', createdAt: '2020-01-01' },
      { id: crypto.randomUUID(), runId: runId, jobId: jobId2, finalDecision: 'REVIEW', primaryReason: 'test', createdAt: '2020-01-01' },
      { id: crypto.randomUUID(), runId: oldRunId, jobId: jobId3, finalDecision: 'APPLY', primaryReason: 'test', createdAt: '2020-01-01' }
    ]);
    
    await db.insert(schema.decisions).values([
      { id: crypto.randomUUID(), runId: runId, jobId: jobId1, decision: 'APPLY', reasons: '[]', createdAt: '2020-01-01' },
      { id: crypto.randomUUID(), runId: runId, jobId: jobId2, decision: 'APPLY', reasons: '[]', createdAt: '2020-01-01' }
    ]);
  });

  it('Dashboard Apply count evaluates candidateDecisions.finalDecision for the latest run', async () => {
    const cdRes = await db.select({
      finalDecision: schema.candidateDecisions.finalDecision
    }).from(schema.candidateDecisions)
      .where(eq(schema.candidateDecisions.runId, runId));
    
    const applyCount = cdRes.filter(d => d.finalDecision === 'APPLY').length;
    const applyThisWeekCount = cdRes.filter(d => d.finalDecision === 'REVIEW').length;
    
    expect(applyCount).toBe(1);
    expect(applyThisWeekCount).toBe(1);
  });
});
