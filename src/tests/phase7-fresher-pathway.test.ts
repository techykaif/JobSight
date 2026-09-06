import { describe, it, expect, beforeAll, vi } from 'vitest';
import { evaluateCandidateDecision } from '../lib/candidate-decision/engine.js';
import { IgnoreStrategy } from '../lib/decision/strategies.js';

vi.mock('../lib/intelligence/market/engine.js', async (importOriginal) => {
  return {
    runMarketIntelligence: vi.fn().mockReturnValue({
      opportunityIntelligence: 'FAVORABLE',
      visibilityLevel: 'HIGH',
      visibilityEvidence: [],
      visibilityConfidence: 'HIGH',
      competitionLevel: 'LOW',
      competitionEvidence: [],
      competitionConfidence: 'HIGH',
      frictionLevel: 'LOW',
      frictionEvidence: [],
      frictionConfidence: 'HIGH',
      authenticityLevel: 'HIGH',
      authenticityEvidence: [],
      authenticityConfidence: 'HIGH'
    })
  };
});

vi.mock('../lib/decision/engine.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    runDecisionEngine: vi.fn().mockResolvedValue({
      decision: 'APPLY_NOW',
      priority: 95,
      confidence: 100,
      reasons: [],
      unknowns: [],
      requiredActions: [],
      roiLevel: 'High',
      urgencyLevel: 'High'
    })
  };
});

describe('Phase 7.1 Locked Stretch Architecture', () => {

  it('1. Extreme gap + ordinary opportunity -> INELIGIBLE (no B7 pollution)', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'strong', score: 90, reasons: [] } as any,
      null, // b7Decision is null since they don't enter B7
      { eligibilityStatus: 'ELIGIBLE' } as any,
      { decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'] } as any,
      { opportunityIntelligence: 'NEUTRAL', visibilityLevel: 'HIGH', competitionLevel: 'HIGH' } as any
    );
    expect(result.finalDecision).toBe('INELIGIBLE');
  });

  it('2. Extreme gap + exceptional verified opportunity -> REVIEW + stretch reason', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'strong', score: 90, reasons: [] } as any,
      null,
      { eligibilityStatus: 'ELIGIBLE' } as any,
      { decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'] } as any,
      { opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'LOW', competitionLevel: 'LOW' } as any
    );
    expect(result.finalDecision).toBe('REVIEW');
    expect(result.primaryReason).toContain('Stretch opportunity');
  });

  it('3. Extreme gap + B6 NOT_ELIGIBLE -> INELIGIBLE (never REVIEW)', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'strong', score: 90, reasons: [] } as any,
      null,
      { eligibilityStatus: 'NOT_ELIGIBLE' } as any, // B6 veto
      { decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'] } as any,
      { opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'LOW', competitionLevel: 'LOW' } as any
    );
    expect(result.finalDecision).toBe('INELIGIBLE');
    expect(result.primaryReason).toContain('Geographic');
  });

  it('4. Extreme gap + insufficient evidence -> NOT Stretch (INELIGIBLE)', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'insufficient_evidence', score: 0, reasons: [] } as any,
      null,
      { eligibilityStatus: 'ELIGIBLE' } as any,
      { decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'] } as any,
      { opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'LOW', competitionLevel: 'LOW' } as any
    );
    expect(result.finalDecision).toBe('INELIGIBLE');
    expect(result.primaryReason).not.toContain('Stretch opportunity');
  });

  it('5. Extreme gap + unknown/neutral market -> INELIGIBLE', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'strong', score: 90, reasons: [] } as any,
      null,
      { eligibilityStatus: 'ELIGIBLE' } as any,
      { decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'] } as any,
      { opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'UNKNOWN', competitionLevel: 'UNKNOWN' } as any
    );
    expect(result.finalDecision).toBe('INELIGIBLE');
  });

  it('6. Normal qualified job + exceptional opportunity -> normal APPLY', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'strong', score: 90, reasons: [] } as any,
      'APPLY_NOW',
      { eligibilityStatus: 'ELIGIBLE' } as any,
      { decision: 'CONSIDER', reasons: [] } as any,
      null
    );
    expect(result.finalDecision).toBe('APPLY');
  });

  it('7. Stretch produces REVIEW, never APPLY', () => {
    const result = evaluateCandidateDecision(
      true,
      { level: 'strong', score: 90, reasons: [] } as any,
      null,
      { eligibilityStatus: 'ELIGIBLE' } as any,
      { decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'] } as any,
      { opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'LOW', competitionLevel: 'LOW' } as any
    );
    expect(result.finalDecision).toBe('REVIEW');
    expect(result.finalDecision).not.toBe('APPLY');
    expect(result.primaryReason).toContain('Stretch opportunity');
  });

  it('8. IgnoreStrategy maps LOW priority correctly (Phase 7.1 preserved)', () => {
    const strategy = new IgnoreStrategy();
    const context = {
      opportunity: { priority: 'LOW' },
      discovery: { authenticity: 'HIGH' }
    };
    expect(strategy.supports(context as any)).toBe(true);
  });
});

import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { runMission } from '../lib/pipeline/orchestrator.js';
import { registerCoreStrategies } from '../lib/decision/engine.js';

describe('Stretch Pipeline Integration & Ranking Integrity', () => {
  beforeAll(() => {
    registerCoreStrategies();
  });

  it('Stretch jobs bypass normal B7 ranking and do not displace qualified jobs', async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();

    await db.insert(schema.huntConfigs).values({ id: configId, targetRoles: [], alternativeRoles: [], createdAt: '', updatedAt: '' });
    await db.insert(schema.runs).values({ id: runId, configId, status: 'RUNNING', profileSnapshot: { name: 'Test', targetRoles: [], skills: [], yearsOfProfessionalExperience: 0 }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    const job1 = crypto.randomUUID();
    const job2 = crypto.randomUUID();

    // Normal qualified job
    await db.insert(schema.jobs).values({ id: job1, canonicalUrl: 'http://norm.al', status: 'ACTIVE', candidateRemoteEligibility: 'ELIGIBLE' as any, firstSeenAt: '', lastSeenAt: '', createdAt: '', updatedAt: '' });
    await db.insert(schema.jobObservations).values({ id: crypto.randomUUID(), runId, jobId: job1, sourceUrl: 'http://norm.al', observedAt: new Date().toISOString(), createdAt: '' });
    await db.insert(schema.decisions).values({ id: crypto.randomUUID(), runId, jobId: job1, decision: 'APPLY', createdAt: '' }); // Qualified
    await db.insert(schema.marketIntelligence).values({ id: crypto.randomUUID(), runId, jobId: job1, opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'HIGH', visibilityEvidence: [], visibilityConfidence: 'HIGH', competitionLevel: 'HIGH', competitionEvidence: [], competitionConfidence: 'HIGH', frictionLevel: 'HIGH', frictionEvidence: [], frictionConfidence: 'HIGH', createdAt: '', updatedAt: '' });
    await db.insert(schema.candidateFitResults).values({ id: crypto.randomUUID(), runId, jobId: job1, level: 'strong', score: 90, reasons: [], createdAt: '', updatedAt: '' });

    // Stretch job
    await db.insert(schema.jobs).values({ id: job2, canonicalUrl: 'http://stre.tch', status: 'ACTIVE', candidateRemoteEligibility: 'ELIGIBLE' as any, firstSeenAt: '', lastSeenAt: '', createdAt: '', updatedAt: '' });
    await db.insert(schema.jobObservations).values({ id: crypto.randomUUID(), runId, jobId: job2, sourceUrl: 'http://stre.tch', observedAt: new Date().toISOString(), createdAt: '' });
    await db.insert(schema.decisions).values({ id: crypto.randomUUID(), runId, jobId: job2, decision: 'SKIP', reasons: ['EXTREME_EXPERIENCE_GAP'], createdAt: '' }); // Failed qual
    await db.insert(schema.marketIntelligence).values({ id: crypto.randomUUID(), runId, jobId: job2, opportunityIntelligence: 'FAVORABLE', visibilityLevel: 'LOW', visibilityEvidence: [], visibilityConfidence: 'HIGH', competitionLevel: 'LOW', competitionEvidence: [], competitionConfidence: 'HIGH', frictionLevel: 'HIGH', frictionEvidence: [], frictionConfidence: 'HIGH', createdAt: '', updatedAt: '' });
    await db.insert(schema.candidateFitResults).values({ id: crypto.randomUUID(), runId, jobId: job2, level: 'strong', score: 90, reasons: [], createdAt: '', updatedAt: '' });
    
    // Run just the ranking phase
    await db.update(schema.runs).set({ lastCheckpoint: 'MARKET_INTELLIGENCE_COMPLETED' }).where(eq(schema.runs.id, runId));
    
    // Simulate pipeline run (will execute RANKING and CANDIDATE_DECISION)
    const abortController = new AbortController();
    await runMission(runId, abortController.signal, () => false);

    // 1. Ranking integrity: Normal B7 queue should ONLY contain job1
    const queues = await db.select().from(schema.decisionQueue).where(eq(schema.decisionQueue.runId, runId));
    expect(queues).toHaveLength(1);
    expect(queues[0].jobId).toBe(job1); // job2 must not pollute B7 queue

    // 2. Only normal jobs should get a decisionResult (B7 output)
    const results = await db.select().from(schema.decisionResults).where(eq(schema.decisionResults.runId, runId));
    expect(results).toHaveLength(1);
    expect(results[0].jobId).toBe(job1);

    // 3. Candidate Decision: Job1 -> APPLY, Job2 -> REVIEW (Stretch)
    const cDecs = await db.select().from(schema.candidateDecisions).where(eq(schema.candidateDecisions.runId, runId));
    expect(cDecs.find(d => d.jobId === job1)?.finalDecision).toBe('APPLY');
    expect(cDecs.find(d => d.jobId === job2)?.finalDecision).toBe('REVIEW');
    expect(cDecs.find(d => d.jobId === job2)?.primaryReason).toContain('Stretch opportunity');
  });
});
