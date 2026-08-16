import { test, expect, describe, beforeAll, vi } from 'vitest';
import * as repos from '../lib/db/repositories/index.js';

vi.mock('../lib/db/repositories/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    saveEvent: vi.fn(),
  };
});
import { calculateB7Modifiers } from '../lib/adaptive-learning/engine.js';
import { generateDecisionQueue } from '../lib/decision/engine.js';
import type { DecisionContext, DecisionResult, QueuedDecision } from '../lib/decision/interfaces.js';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';

describe('B7 Adaptive Learning Intelligence', () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  const runId = 'test_b7_run';
  const configId = 'test_b7_config';

  const setupMockJobContext = (id: string, priority: number, companyId?: string, remoteType?: string): { context: DecisionContext, result: DecisionResult } => {
    return {
      context: {
        job: {
          id,
          sourceUrl: `https://test.com/${id}`,
          title: 'Test Job',
          companyName: 'Test Co',
          companyId,
          remoteType: remoteType as any
        } as any,
        runId,
        discovery: { result: { level: 'STANDARD', score: 50, confidence: 50 }, signals: [], authenticity: 'HIGH', visibility: 'HIGH', competition: 'LOW', freshness: 'TODAY' } as any,
        opportunity: { opportunityScore: 50, priority: 'NORMAL', recommendedAction: 'CONSIDER' } as any
      },
      result: {
        decision: 'CONSIDER' as any,
        priority,
        confidence: 80,
        reasons: [],
        unknowns: [],
        requiredActions: [],
        roiLevel: 'MEDIUM',
        urgencyLevel: 'UNKNOWN'
      }
    };
  };

  test('Cold Start - No history produces 0 modifier', async () => {
    const queueInput = [
      setupMockJobContext('job1', 50, 'comp1', 'REMOTE')
    ];
    
    // Convert to QueuedDecision format expected by calculateB7Modifiers
    const mappedQueue = queueInput.map((d, i) => ({
      jobId: (d.context.job as any).id,
      rank: i + 1,
      result: d.result,
      context: d.context as any
    }));

    const mods = await calculateB7Modifiers({ runId, configId: 'empty_config' }, mappedQueue);
    expect(mods['job1']).toBe(0);
  });

  test('Insufficient Observations - Below threshold produces 0 modifier', async () => {
    const testConfigId = crypto.randomUUID();
    const testRunId = crypto.randomUUID();
    
    await db.insert(schema.huntConfigs).values({
      id: testConfigId,
      targetRoles: [],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.runs).values({
      id: testRunId,
      configId: testConfigId,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.companies).values({
      id: 'compA',
      normalizedName: 'compa',
      displayName: 'Comp A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const jobId = crypto.randomUUID();
    await db.insert(schema.jobs).values({
      id: jobId,
      companyId: 'compA',
      remoteType: 'REMOTE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobObservations).values({
      id: crypto.randomUUID(),
      jobId,
      runId: testRunId,
      observedAt: new Date().toISOString()
    });

    await db.insert(schema.decisionHistory).values({
      id: crypto.randomUUID(),
      jobId,
      previousDecision: 'CONSIDER',
      newDecision: 'APPLY_NOW', // Positive
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const queueInput = [
      setupMockJobContext('jobA', 50, 'compA', 'REMOTE')
    ];
    
    const mappedQueue = queueInput.map((d, i) => ({
      jobId: (d.context.job as any).id,
      rank: i + 1,
      result: d.result,
      context: d.context as any
    }));

    const mods = await calculateB7Modifiers({ runId: testRunId, configId: testConfigId }, mappedQueue);
    expect(mods['jobA']).toBe(0);
  });

  test('Positive Preference - Multiple positive observations boost priority', async () => {
    const testConfigId = crypto.randomUUID();
    const testRunId = crypto.randomUUID();
    
    await db.insert(schema.huntConfigs).values({
      id: testConfigId,
      targetRoles: [],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.runs).values({
      id: testRunId,
      configId: testConfigId,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.companies).values({
      id: 'compB',
      normalizedName: 'compb',
      displayName: 'Comp B',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    for (let i = 0; i < 4; i++) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({
        id: jobId,
        companyId: 'compB',
        remoteType: 'ONSITE',
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.insert(schema.jobObservations).values({
        id: crypto.randomUUID(),
        jobId,
        runId: testRunId,
        observedAt: new Date().toISOString()
      });

      await db.insert(schema.decisionHistory).values({
        id: crypto.randomUUID(),
        jobId,
        previousDecision: 'CONSIDER',
        newDecision: 'APPLY_NOW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const queueInput = [
      setupMockJobContext('jobB', 50, 'compB', 'ONSITE')
    ];
    
    const mappedQueue = queueInput.map((d, i) => ({
      jobId: (d.context.job as any).id,
      rank: i + 1,
      result: d.result,
      context: d.context as any
    }));

    const mods = await calculateB7Modifiers({ runId: testRunId, configId: testConfigId }, mappedQueue);
    expect(mods['jobB']).toBeGreaterThan(0);
  });

  test('Negative Preference - Multiple negative observations lower priority', async () => {
    const testConfigId = crypto.randomUUID();
    const testRunId = crypto.randomUUID();
    
    await db.insert(schema.huntConfigs).values({
      id: testConfigId,
      targetRoles: [],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.runs).values({
      id: testRunId,
      configId: testConfigId,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.companies).values({
      id: 'compC',
      normalizedName: 'compc',
      displayName: 'Comp C',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    for (let i = 0; i < 4; i++) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({
        id: jobId,
        companyId: 'compC',
        remoteType: 'ONSITE',
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.insert(schema.jobObservations).values({
        id: crypto.randomUUID(),
        jobId,
        runId: testRunId,
        observedAt: new Date().toISOString()
      });

      await db.insert(schema.decisionHistory).values({
        id: crypto.randomUUID(),
        jobId,
        previousDecision: 'CONSIDER',
        newDecision: 'SKIP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const queueInput = [
      setupMockJobContext('jobC', 50, 'compC', 'ONSITE')
    ];
    
    const mappedQueue = queueInput.map((d, i) => ({
      jobId: (d.context.job as any).id,
      rank: i + 1,
      result: d.result,
      context: d.context as any
    }));

    const mods = await calculateB7Modifiers({ runId: testRunId, configId: testConfigId }, mappedQueue);
    expect(mods['jobC']).toBeLessThan(0);
  });

  test('Ranking Preservation - Bounded modifier alters order properly without destroying scale', async () => {
    const queueInput = [
      setupMockJobContext('jobHigh', 90, 'compHigh', 'REMOTE'),
      setupMockJobContext('jobMed', 50, 'compMed', 'REMOTE'),
      setupMockJobContext('jobLow', 20, 'compLow', 'REMOTE')
    ];

    const modifiers = {
      'jobHigh': -0.15,
      'jobMed': +0.15,
      'jobLow': +0.15
    };

    const finalQueue = await generateDecisionQueue('test_run', queueInput, modifiers);

    expect(finalQueue[0]!.jobId).toBe('https://test.com/jobHigh');
    expect(finalQueue[1]!.jobId).toBe('https://test.com/jobMed');
    expect(finalQueue[2]!.jobId).toBe('https://test.com/jobLow');
  });

  test('Ranking Inversion - Bounded modifier flips closely ranked jobs', async () => {
    const queueInput = [
      setupMockJobContext('jobA', 55, 'compA', 'REMOTE'),
      setupMockJobContext('jobB', 50, 'compB', 'REMOTE')
    ];

    const modifiers = {
      'jobA': -0.15,
      'jobB': +0.15
    };

    const finalQueue = await generateDecisionQueue('test_run', queueInput, modifiers);

    expect(finalQueue[0]!.jobId).toBe('https://test.com/jobB');
    expect(finalQueue[1]!.jobId).toBe('https://test.com/jobA');
  });

  test('B6 Authority Integration - B7 cannot override B6 NOT_ELIGIBLE or resurrect hard-failed jobs', async () => {
    // A job marked NOT_ELIGIBLE by B6
    const notEligibleJob = setupMockJobContext('jobNotEligible', 50, 'compA', 'REMOTE');
    (notEligibleJob.context.job as any).candidateRemoteEligibility = 'NOT_ELIGIBLE';
    
    // A job marked UNKNOWN by B6
    const unknownJob = setupMockJobContext('jobUnknown', 50, 'compA', 'REMOTE');
    (unknownJob.context.job as any).candidateRemoteEligibility = 'UNKNOWN';

    // B7 produces a strong positive preference
    const modifiers = {
      'jobNotEligible': +0.15,
      'jobUnknown': +0.15
    };

    const finalQueue = await generateDecisionQueue('test_run', [notEligibleJob, unknownJob], modifiers);

    // Verify properties remain completely untouched by B7
    expect((finalQueue[0]!.context.job as any).candidateRemoteEligibility).toBe('NOT_ELIGIBLE');
    expect((finalQueue[1]!.context.job as any).candidateRemoteEligibility).toBe('UNKNOWN');
    
    // In actual orchestrator flow, NOT_ELIGIBLE jobs are filtered out before B7.
    // This test proves that even if they accidentally reach the queue generator, 
    // B7 modifiers are purely mathematical nudges to priority and DO NOT mutate B6 state.
    expect(finalQueue[0]!.result.priority).toBe(50);
  });

  test('Ownership Isolation - Config B does not learn from Config A history', async () => {
    // We create a new config (Config A) and populate strong preference
    const configA = crypto.randomUUID();
    const runA = crypto.randomUUID();
    
    await db.insert(schema.huntConfigs).values({
      id: configA, targetRoles: [], alternativeRoles: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    await db.insert(schema.runs).values({
      id: runA, configId: configA, status: 'COMPLETED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    await db.insert(schema.companies).values({
      id: 'compIso', normalizedName: 'compiso', displayName: 'Comp Iso', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    for (let i = 0; i < 5; i++) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({ id: jobId, companyId: 'compIso', remoteType: 'REMOTE', status: 'ACTIVE', firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await db.insert(schema.jobObservations).values({ id: crypto.randomUUID(), jobId, runId: runA, observedAt: new Date().toISOString() });
      await db.insert(schema.decisionHistory).values({ id: crypto.randomUUID(), jobId, previousDecision: 'CONSIDER', newDecision: 'APPLY_NOW', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    // We create Config B
    const configB = crypto.randomUUID();
    const runB = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: configB, targetRoles: [], alternativeRoles: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    await db.insert(schema.runs).values({
      id: runB, configId: configB, status: 'COMPLETED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    const queueInput = [ setupMockJobContext('jobIso', 50, 'compIso', 'REMOTE') ];
    const mappedQueue = queueInput.map((d, i) => ({ jobId: (d.context.job as any).id, rank: i + 1, result: d.result, context: d.context as any }));

    // Calculating mods for Config B should yield 0 since history is bound to Config A
    const mods = await calculateB7Modifiers({ runId: runB, configId: configB }, mappedQueue);
    expect(mods['jobIso'] || 0).toBe(0); // Actually our engine maps it to 0 if no mod.  
    // Wait, the engine returns an object where absent keys mean 0, or let's assert it is either 0 or undefined.
    expect(mods['jobIso'] || 0).toBe(0);
  });
});
