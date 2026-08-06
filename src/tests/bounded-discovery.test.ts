import { describe, it, expect, beforeAll, vi } from 'vitest';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { runMission } from '../lib/pipeline/orchestrator';

// Mock AGY runner
vi.mock('../lib/agy/runner.js', () => ({
  runAgyTask: vi.fn().mockImplementation(async () => {
    return {
      experienceStrictness: 'MODERATE',
      actualSeniority: 'MID',
      responsibilityComplexity: 'MODERATE',
      portfolioExperienceRelevant: false,
      majorBlockers: [],
      positiveSignals: [],
      reasoning: ['Test analysis'],
      confidence: 0.9
    };
  }),
  runAgyUnstructured: vi.fn().mockResolvedValue('Test research text')
}));

// Mock qualifyJob to return controlled decisions
vi.mock('../lib/qualification/engine.js', async () => {
  const actual = await vi.importActual('../lib/qualification/engine.js') as any;
  return {
    ...actual,
    qualifyJob: vi.fn().mockImplementation(async (job: any) => {
      // Jobs with "GOOD" in title -> APPLY (usable)
      // Jobs with "MEH" in title -> SKIP (not usable)
      const isGood = job.canonicalTitle.includes('GOOD');
      return {
        decision: isGood ? 'APPLY' : 'SKIP',
        reasons: [isGood ? 'High opportunity score (85/100)' : 'Low opportunity score (30/100)'],
        unknowns: [],
        scores: {
          resumeMatch: isGood ? 85 : 30,
          requirementMatch: isGood ? 90 : 25,
          opportunity: isGood ? 85 : 30,
          confidence: 0.9,
          extremeExperienceGap: false
        },
        analysis: null
      };
    })
  };
});

// Mock company research
vi.mock('../lib/company/engine.js', () => ({
  getCompanyIntelligence: vi.fn().mockImplementation(async (_job: any, _name: string, opp: number, dec: string) => ({
    decision: dec,
    scores: { companyScore: 80, hiringMomentum: 75, opportunityV2: opp + 5, applicationPriority: 80 }
  }))
}));

describe('Bounded Over-Discovery', () => {
  let testConfigId: string;
  let profileId: string;

  beforeAll(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });

    testConfigId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: testConfigId,
      targetRoles: ['Software Engineer'],
      alternativeRoles: [],
      requireSalaryDisclosure: false,
      maximumUsableResults: 2, // Only want 2 usable results
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    profileId = crypto.randomUUID();
    await db.insert(schema.profiles).values({
      id: profileId,
      name: 'Over-Discovery Test Profile',
      yearsOfProfessionalExperience: 3,
      targetRoles: ['Software Engineer'],
      skills: ['TypeScript'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  it('continues past rejected candidates until usable count is met', async () => {
    const runId = crypto.randomUUID();

    await db.insert(schema.runs).values({
      id: runId,
      configId: testConfigId,
      status: 'CREATED',
      lastCheckpoint: 'DISCOVERY_COMPLETED', // Skip discovery
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Insert 6 jobs: MEH, MEH, GOOD, MEH, GOOD, GOOD
    // With maxUsable=2, should process until 2 GOOD are found, then stop
    const jobTitles = [
      'MEH Software Engineer 1',   // -> SKIP
      'MEH Software Engineer 2',   // -> SKIP
      'GOOD Frontend Engineer 1',  // -> APPLY (usable #1)
      'MEH Software Engineer 3',   // -> SKIP
      'GOOD Frontend Engineer 2',  // -> APPLY (usable #2) -- should stop here
      'GOOD Frontend Engineer 3',  // Should NOT be reached
    ];

    for (const title of jobTitles) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({
        id: jobId,
        canonicalTitle: title,
        status: 'ACTIVE',
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.insert(schema.jobObservations).values({
        id: crypto.randomUUID(),
        jobId,
        runId,
        observedAt: new Date().toISOString()
      });
    }

    await runMission(runId, new AbortController().signal, () => false);

    const decisions = await db.select().from(schema.decisions)
      .where(eq(schema.decisions.runId, runId));
    
    const usableDecisions = decisions.filter(d => ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'].includes(d.decision));
    const skipDecisions = decisions.filter(d => d.decision === 'SKIP');
    
    // Should have exactly 2 usable results
    expect(usableDecisions.length).toBe(2);
    
    // Total decisions should be less than 6 (some were skipped by early termination)
    expect(decisions.length).toBeLessThan(6);
    
    // The pipeline must have inspected more than just 2 candidates (over-discovery)
    expect(decisions.length).toBeGreaterThan(2);

    // Verify MAX_USABLE_RESULTS_REACHED event was emitted
    const events = await db.select().from(schema.pipelineEvents)
      .where(eq(schema.pipelineEvents.runId, runId));
    const maxUsableEvent = events.find(e => e.eventType === 'MAX_USABLE_RESULTS_REACHED');
    expect(maxUsableEvent).toBeDefined();
    expect((maxUsableEvent!.payload as any).message).toContain('Reached target of 2 usable results');
  });

  it('processes all candidates when usable target is not reached', async () => {
    const runId = crypto.randomUUID();

    await db.insert(schema.runs).values({
      id: runId,
      configId: testConfigId,
      status: 'CREATED',
      lastCheckpoint: 'DISCOVERY_COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Only 1 GOOD job among 3 MEH - will never reach maxUsable=2
    const jobTitles = [
      'MEH Backend Developer 1',
      'GOOD Full Stack Dev',
      'MEH Backend Developer 2',
    ];

    for (const title of jobTitles) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({
        id: jobId,
        canonicalTitle: title,
        status: 'ACTIVE',
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.insert(schema.jobObservations).values({
        id: crypto.randomUUID(),
        jobId,
        runId,
        observedAt: new Date().toISOString()
      });
    }

    await runMission(runId, new AbortController().signal, () => false);

    const decisions = await db.select().from(schema.decisions)
      .where(eq(schema.decisions.runId, runId));
    
    // All 3 should be qualified since we never reached maxUsable=2
    expect(decisions.length).toBe(3);
    
    const usable = decisions.filter(d => ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'].includes(d.decision));
    expect(usable.length).toBe(1);

    // No MAX_USABLE_RESULTS_REACHED event
    const events = await db.select().from(schema.pipelineEvents)
      .where(eq(schema.pipelineEvents.runId, runId));
    const maxUsableEvent = events.find(e => e.eventType === 'MAX_USABLE_RESULTS_REACHED');
    expect(maxUsableEvent).toBeUndefined();
  });

  it('maximumUsableResults=3 means 3 surviving opportunities, NOT 3 inspected', async () => {
    // Use a different config with maxUsable=3
    const configId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ['Software Engineer'],
      alternativeRoles: [],
      requireSalaryDisclosure: false,
      maximumUsableResults: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const runId = crypto.randomUUID();
    await db.insert(schema.runs).values({
      id: runId,
      configId,
      status: 'CREATED',
      lastCheckpoint: 'DISCOVERY_COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 8 jobs: first 4 are MEH (rejected), next 4 are GOOD
    // Should process 7 total (4 MEH + 3 GOOD), skip the 8th
    const jobTitles = [
      'MEH Job A', 'MEH Job B', 'MEH Job C', 'MEH Job D',
      'GOOD Job E', 'GOOD Job F', 'GOOD Job G', 'GOOD Job H'
    ];

    for (const title of jobTitles) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({
        id: jobId,
        canonicalTitle: title,
        status: 'ACTIVE',
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await db.insert(schema.jobObservations).values({
        id: crypto.randomUUID(),
        jobId,
        runId,
        observedAt: new Date().toISOString()
      });
    }

    await runMission(runId, new AbortController().signal, () => false);

    const decisions = await db.select().from(schema.decisions)
      .where(eq(schema.decisions.runId, runId));

    const usable = decisions.filter(d => ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'].includes(d.decision));
    const skipped = decisions.filter(d => d.decision === 'SKIP');

    // Exactly 3 usable
    expect(usable.length).toBe(3);
    
    // More than 3 total inspected (proves it's not just inspecting 3)
    expect(decisions.length).toBeGreaterThan(3);
    
    // At least 4 skips (all MEH jobs)
    expect(skipped.length).toBe(4);
    
    // Total = 7 (4 MEH + 3 GOOD), not 8 (last GOOD skipped)
    expect(decisions.length).toBe(7);
  });
});
