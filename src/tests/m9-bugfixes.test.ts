import { describe, it, expect, beforeAll, vi } from 'vitest';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { runMission } from '../lib/pipeline/orchestrator';

// Mock AGY runner so we don't hit the real API
vi.mock('../lib/agy/runner.js', () => ({
  runAgyTask: vi.fn().mockImplementation(async ({ schema: zSchema }) => {
    // Return dummy analysis data
    return {
      experienceStrictness: 'MODERATE',
      actualSeniority: 'MID',
      responsibilityComplexity: 'MODERATE',
      portfolioExperienceRelevant: false,
      majorBlockers: [],
      positiveSignals: [],
      reasoning: ['Dummy reasoning'],
      confidence: 0.9
    };
  }),
  runAgyUnstructured: vi.fn().mockResolvedValue('Dummy research text')
}));

// Mock qualifyJob to allow forcing failures
vi.mock('../lib/qualification/engine.js', async () => {
  const actual = await vi.importActual('../lib/qualification/engine.js') as any;
  return {
    ...actual,
    qualifyJob: vi.fn().mockImplementation(async (job, config, profile, abortSignal) => {
      if (job.canonicalTitle.includes('CRASH')) {
        throw new Error('Forced crash for testing');
      }
      return actual.qualifyJob(job, config, profile, abortSignal);
    })
  };
});

// Mock getCompanyIntelligence to not actually hit AGY
vi.mock('../lib/company/engine.js', () => ({
  getCompanyIntelligence: vi.fn().mockImplementation(async (job, name, opp, dec) => {
    return {
      decision: dec,
      scores: {
        companyScore: 80,
        hiringMomentum: 75,
        opportunityV2: opp + 5,
        applicationPriority: 80
      }
    };
  })
}));

describe('M9 Bugfixes: Orchestrator & Qualification', () => {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    profileId = crypto.randomUUID();
  });

  const setupTest = async (profileData: any, jobsData: any[]) => {
    const runId = crypto.randomUUID();
    
    // Insert/update profile
    await db.delete(schema.profiles);
    await db.insert(schema.profiles).values({
      id: profileId,
      name: 'Test Profile',
      yearsOfProfessionalExperience: 2,
      targetRoles: ['Software Engineer'],
      skills: ['TypeScript'],
      projectExperience: [],
      education: 'BSc',
      preferredRoles: [],
      allowedRegions: [],
      employmentPreferences: [],
      remotePreference: 'HYBRID_ACCEPTABLE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...profileData
    });

    await db.insert(schema.runs).values({
      id: runId,
      configId: testConfigId,
      status: 'CREATED',
      lastCheckpoint: 'DISCOVERY_COMPLETED', // Skip discovery
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    for (const job of jobsData) {
      const jobId = crypto.randomUUID();
      await db.insert(schema.jobs).values({ canonicalUrl: `https://example.com/job-${crypto.randomUUID()}`,
        id: jobId,
        canonicalTitle: job.title,
        status: 'ACTIVE',
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        description: job.description || JSON.stringify({}),
        experienceMin: job.experienceMin ?? null,
        experienceMax: job.experienceMax ?? null,
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

    return runId;
  };

  it('handles exact null case for salaryExpectations and missing fields', async () => {
    const runId = await setupTest({
      salaryExpectations: null, // EXACT NULL CASE
    }, [
      { title: 'Normal Job', experienceMin: 2, experienceMax: 5 }
    ]);

    await runMission(runId, new AbortController().signal, () => false);

    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
    expect(run[0]!.status).toBe('COMPLETED'); // Should not crash!

    const decs = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
    expect(decs.length).toBe(1);
    expect(decs[0]!.decision).not.toBe('FAILED');
  });

  it('all qualification fail test', async () => {
    const runId = await setupTest({ salaryExpectations: null }, [
      { title: 'Job CRASH 1' },
      { title: 'Job CRASH 2' },
      { title: 'Job CRASH 3' }
    ]);

    await runMission(runId, new AbortController().signal, () => false);
    await db.update(schema.runs).set({ lastCheckpoint: 'DISCOVERY_COMPLETED' }).where(eq(schema.runs.id, runId));
    await runMission(runId, new AbortController().signal, () => false); // 2nd attempt

    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
    expect(run[0]!.status).toBe('FAILED');

    const decs = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
    expect(decs.length).toBe(3);
    expect(decs[0]!.decision).toBe('FAILED');
    expect(decs[1]!.decision).toBe('FAILED');
    expect(decs[2]!.decision).toBe('FAILED');
  });

  it('mixed result test', async () => {
    const runId = await setupTest({ salaryExpectations: null }, [
      { title: 'Normal Job' }, // Should pass and yield a decision
      { title: 'Job CRASH' }, // Should fail
      { title: 'Principal Software Engineer CRASH', experienceMin: 12 } // This is a deterministic SKIP, wait, if title says CRASH it crashes.
    ]);
    // Let's use a non-crash Principal job to test deterministic skip
    await db.insert(schema.jobs).values({ canonicalUrl: `https://example.com/job-${crypto.randomUUID()}`,
      id: crypto.randomUUID(),
      canonicalTitle: 'Principal Software Engineer',
      status: 'ACTIVE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      description: JSON.stringify({}),
      experienceMin: 12,
      experienceMax: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning({ id: schema.jobs.id }).then(async (res) => {
      await db.insert(schema.jobObservations).values({ id: crypto.randomUUID(), jobId: res[0]!.id, runId, observedAt: new Date().toISOString() });
    });

    await runMission(runId, new AbortController().signal, () => false);
    await db.update(schema.runs).set({ lastCheckpoint: 'DISCOVERY_COMPLETED' }).where(eq(schema.runs.id, runId));
    await runMission(runId, new AbortController().signal, () => false); // 2nd attempt

    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
    expect(run[0]!.status).toBe('COMPLETED_WITH_FAILURES');

    const decs = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
    
    const crashJobDec = decs.find(d => (d.reasons as string[])?.includes('Qualification failed permanently: Forced crash for testing'));
    expect(crashJobDec).toBeDefined();
    expect(crashJobDec!.decision).toBe('FAILED');

    const skipJobDec = decs.find(d => (d.reasons as string[])?.includes('EXTREME_EXPERIENCE_GAP'));
    expect(skipJobDec).toBeDefined();
    expect(skipJobDec!.decision).toBe('SKIP');
  });

  it('terminal state invariant: no run-owned candidate remains unintentionally PENDING', async () => {
    // This is implicitly tested because we verify decision states.
    // Let's ensure every job has a decision.
    const runId = await setupTest({ salaryExpectations: null }, [
      { title: 'Normal Job' },
      { title: 'Job CRASH' }
    ]);
    
    await runMission(runId, new AbortController().signal, () => false);
    await db.update(schema.runs).set({ lastCheckpoint: 'DISCOVERY_COMPLETED' }).where(eq(schema.runs.id, runId));
    await runMission(runId, new AbortController().signal, () => false); // 2nd attempt

    const obs = await db.select().from(schema.jobObservations).where(eq(schema.jobObservations.runId, runId));
    const decs = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
    expect(decs.length).toBe(obs.length);
  });

  it('empty company research test', async () => {
    // 1 job that yields a SKIP decision so no company research is eligible
    const runId = await setupTest({ salaryExpectations: null }, []);
    
    // Insert a job that will definitely be SKIPPED
    await db.insert(schema.jobs).values({ canonicalUrl: `https://example.com/job-${crypto.randomUUID()}`,
      id: crypto.randomUUID(),
      canonicalTitle: 'Skipped Job',
      status: 'ACTIVE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      description: JSON.stringify({}),
      experienceMin: 20, // Extreme experience gap
      experienceMax: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning({ id: schema.jobs.id }).then(async (res) => {
      await db.insert(schema.jobObservations).values({ id: crypto.randomUUID(), jobId: res[0]!.id, runId, observedAt: new Date().toISOString() });
    });

    await runMission(runId, new AbortController().signal, () => false);

    const events = await db.select().from(schema.pipelineEvents).where(eq(schema.pipelineEvents.runId, runId));
    
    const researchStartedEvent = events.find(e => e.eventType === 'COMPANY_RESEARCH_STARTED');
    expect(researchStartedEvent).toBeUndefined();

    const researchSkippedEvent = events.find(e => e.eventType === 'COMPANY_RESEARCH_SKIPPED');
    expect(researchSkippedEvent).toBeDefined();
    expect((researchSkippedEvent!.payload as any).message).toContain('Skipped company research: NO_ELIGIBLE_JOBS');
  });
});
