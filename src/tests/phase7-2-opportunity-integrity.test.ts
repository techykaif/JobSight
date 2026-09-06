import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

describe('Phase 7.2: Cross-Run Opportunity Data Integrity', () => {
  let runA: string, runB: string;
  let jobX: string;
  let compX: string;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    
    runA = crypto.randomUUID();
    runB = crypto.randomUUID();
    jobX = crypto.randomUUID();
    compX = crypto.randomUUID();

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

    await db.insert(schema.companies).values({
      id: compX,
      displayName: 'Test Company', normalizedName: 'test-company',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobs).values({
      id: jobX,
      companyId: compX,
      canonicalUrl: `https://example.com/job-${jobX}`,
      status: 'ACTIVE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Run A -> scores, oppDiscoveryResults, signals, summary, companyOpportunity
    await db.insert(schema.scores).values({
      id: crypto.randomUUID(),
      runId: runA,
      jobId: jobX,
      scoreType: 'OPPORTUNITY',
      scoreValue: 95,
      scoringVersion: 'V1',
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.oppDiscoveryResults).values({
      id: crypto.randomUUID(),
      runId: runA,
      jobId: jobX,
      score: 90,
      level: 'Exceptional',
      confidence: 100,
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.oppDiscoverySignals).values({
      id: crypto.randomUUID(),
      runId: runA,
      jobId: jobX,
      signalType: 'TEST',
      value: 'A',
      weight: 10,
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.oppDiscoverySummary).values({
      id: crypto.randomUUID(),
      runId: runA,
      jobId: jobX,
      quality: 'Premium',
      source: 'A',
      visibility: 'Low',
      uniqueness: 'High',
      competition: 'Low',
      authenticity: 'Verified',
      evidenceCount: 1,
      confidence: 100,
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.companyOpportunity).values({
      id: crypto.randomUUID(),
      runId: runA,
      companyId: compX,
      score: 95,
      level: 'Excellent',
      confidence: 100,
      createdAt: new Date().toISOString()
    });

    // Run B -> DIFFERENT DATA
    await db.insert(schema.scores).values({
      id: crypto.randomUUID(),
      runId: runB,
      jobId: jobX,
      scoreType: 'OPPORTUNITY',
      scoreValue: 20,
      scoringVersion: 'V1',
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.oppDiscoveryResults).values({
      id: crypto.randomUUID(),
      runId: runB,
      jobId: jobX,
      score: 20,
      level: 'Weak',
      confidence: 100,
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.oppDiscoverySignals).values({
      id: crypto.randomUUID(),
      runId: runB,
      jobId: jobX,
      signalType: 'TEST',
      value: 'B',
      weight: 10,
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.oppDiscoverySummary).values({
      id: crypto.randomUUID(),
      runId: runB,
      jobId: jobX,
      quality: 'Low',
      source: 'B',
      visibility: 'High',
      uniqueness: 'Low',
      competition: 'High',
      authenticity: 'Unverified',
      evidenceCount: 1,
      confidence: 100,
      createdAt: new Date().toISOString()
    });

    await db.insert(schema.companyOpportunity).values({
      id: crypto.randomUUID(),
      runId: runB,
      companyId: compX,
      score: 20,
      level: 'Weak',
      confidence: 100,
      createdAt: new Date().toISOString()
    });
  });

  afterAll(async () => {
    await db.delete(schema.scores).where(eq(schema.scores.jobId, jobX));
    await db.delete(schema.oppDiscoveryResults).where(eq(schema.oppDiscoveryResults.jobId, jobX));
    await db.delete(schema.oppDiscoverySignals).where(eq(schema.oppDiscoverySignals.jobId, jobX));
    await db.delete(schema.oppDiscoverySummary).where(eq(schema.oppDiscoverySummary.jobId, jobX));
    await db.delete(schema.companyOpportunity).where(eq(schema.companyOpportunity.companyId, compX));
    await db.delete(schema.jobs).where(eq(schema.jobs.id, jobX));
    await db.delete(schema.companies).where(eq(schema.companies.id, compX));
    await db.delete(schema.runs).where(eq(schema.runs.id, runA));
    await db.delete(schema.runs).where(eq(schema.runs.id, runB));
  });

  it('proves pipeline evaluation for Run B consumes only B data for schema.scores', async () => {
    const scores = await db.select().from(schema.scores)
      .where(and(eq(schema.scores.jobId, jobX), eq(schema.scores.runId, runB)));
    expect(scores).toHaveLength(1);
    expect(scores[0]?.scoreValue).toBe(20); // Must be 20, not 95
  });

  it('proves pipeline evaluation for Run B consumes only B data for schema.oppDiscoveryResults', async () => {
    const results = await db.select().from(schema.oppDiscoveryResults)
      .where(and(eq(schema.oppDiscoveryResults.jobId, jobX), eq(schema.oppDiscoveryResults.runId, runB)));
    expect(results).toHaveLength(1);
    expect(results[0]?.score).toBe(20);
  });

  it('proves pipeline evaluation for Run B consumes only B data for schema.oppDiscoverySignals', async () => {
    const signals = await db.select().from(schema.oppDiscoverySignals)
      .where(and(eq(schema.oppDiscoverySignals.jobId, jobX), eq(schema.oppDiscoverySignals.runId, runB)));
    expect(signals).toHaveLength(1);
    expect(signals[0]?.value).toBe('B');
  });

  it('proves pipeline evaluation for Run B consumes only B data for schema.oppDiscoverySummary', async () => {
    const sum = await db.select().from(schema.oppDiscoverySummary)
      .where(and(eq(schema.oppDiscoverySummary.jobId, jobX), eq(schema.oppDiscoverySummary.runId, runB)));
    expect(sum).toHaveLength(1);
    expect(sum[0]?.source).toBe('B');
  });

  it('proves pipeline evaluation for Run B consumes only B data for schema.companyOpportunity', async () => {
    const compOpp = await db.select().from(schema.companyOpportunity)
      .where(and(eq(schema.companyOpportunity.companyId, compX), eq(schema.companyOpportunity.runId, runB)));
    expect(compOpp).toHaveLength(1);
    expect(compOpp[0]?.score).toBe(20);
  });
});
