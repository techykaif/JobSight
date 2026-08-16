import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { evaluateCandidateFit } from '../lib/candidate-fit/engine.js';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

describe('D1.7.4 Candidate Fit Intelligence', () => {
  const testUserId = 'test_fit_user';
  let runId = '';

  beforeEach(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    runId = crypto.randomUUID();
    
    // Create Profile
    await db.insert(schema.profiles).values({
      id: 'fit-prof-1',
      userId: testUserId,
      name: 'Test Fit Profile',
      yearsOfProfessionalExperience: 5,
      targetRoles: ['Software Engineer', 'Full Stack Developer'],
      skills: ['TypeScript', 'React', 'Node.js', 'SQL'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create HuntConfig
    await db.insert(schema.huntConfigs).values({
      id: 'fit-config-1',
      profileId: 'fit-prof-1',
      targetRoles: ['Engineer'],
      alternativeRoles: [],
      candidateCountry: 'USA',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    // Create Run with Profile Snapshot
    const profile = await db.select().from(schema.profiles).where(eq(schema.profiles.id, 'fit-prof-1')).get();
    
    await db.insert(schema.runs).values({
      id: runId,
      configId: 'fit-config-1',
      status: 'RUNNING',
      currentStage: 'INGESTION',
      profileSnapshot: {
        profileId: 'fit-prof-1',
        profileName: 'Test Fit Profile',
        snapshotAt: new Date().toISOString(),
        profile
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  afterEach(async () => {
    await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, runId));
    await db.delete(schema.runs).where(eq(schema.runs.id, runId));
    await db.delete(schema.huntConfigs).where(eq(schema.huntConfigs.id, 'fit-config-1'));
    await db.delete(schema.profiles).where(eq(schema.profiles.id, 'fit-prof-1'));
  });

  const getBaseJob = (overrides: any = {}) => ({
    company: { name: 'Test Co' },
    job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' as const },
    description: {},
    experience: {},
    compensation: {},
    ...overrides
  });

  const insertTestJob = async (id: string) => {
    await db.insert(schema.jobs).values({
      id,
      companyId: null,
      canonicalTitle: 'Title',
      canonicalUrl: `http://test.com/${id}`,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  it('1. Strong overall match', async () => {
    await insertTestJob('job-1');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 4 },
      description: { requiredSkills: ['typescript', 'react', 'sql'] }
    });

    const result = await evaluateCandidateFit(runId, 'job-1', job);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
    expect(result!.level).toBe('strong');
    expect(result!.dimensions.experience).toBe(100);
    expect(result!.dimensions.skills).toBe(100);
    expect(result!.dimensions.role).toBe(100);
  });

  it('3. Partial skill match', async () => {
    await insertTestJob('job-2');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 5 },
      description: { requiredSkills: ['typescript', 'react', 'python', 'go'] }
    });

    const result = await evaluateCandidateFit(runId, 'job-2', job);
    expect(result!.dimensions.skills).toBe(50); // 2 out of 4 matches
    expect(result!.score).toBe(83); // (100 exp + 50 skill + 100 role) / 3 = 83
    expect(result!.level).toBe('strong');
  });

  it('5. Experience mismatch', async () => {
    await insertTestJob('job-3');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 10 }
    });

    const result = await evaluateCandidateFit(runId, 'job-3', job);
    expect(result!.dimensions.experience).toBe(0); // 5 < 10
    expect(result!.score).toBe(50); // (0 exp + 100 role) / 2 = 50
    expect(result!.level).toBe('partial');
  });

  it('8. Missing job requirements', async () => {
    await insertTestJob('job-4');
    const job = getBaseJob({
      job: { title: 'Developer', url: 'http://test.com', status: 'ACTIVE' }
    });

    const result = await evaluateCandidateFit(runId, 'job-4', job);
    expect(result!.dimensions.experience).toBeNull();
    expect(result!.dimensions.skills).toBeNull();
    // Role matching 'Developer' against 'Full Stack Developer' is partial or strong depending on includes logic
    expect(result!.dimensions.role).toBe(100); // job title 'developer' is inside 'full stack developer'
    expect(result!.score).toBe(100);
  });

  it('10. Insufficient evidence', async () => {
    await insertTestJob('job-5');
    const job = getBaseJob({
      job: { title: 'Manager', url: 'http://test.com', status: 'ACTIVE' }
    });

    const result = await evaluateCandidateFit(runId, 'job-5', job);
    // Title doesn't match, no experience, no skills
    expect(result!.dimensions.role).toBe(0);
    expect(result!.dimensions.experience).toBeNull();
    expect(result!.dimensions.skills).toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.level).toBe('weak');
  });

  it('11. Profile-less Run explicitly unavailable', async () => {
    await insertTestJob('job-6');
    const nullRunId = crypto.randomUUID();
    await db.insert(schema.runs).values({
      id: nullRunId,
      configId: 'fit-config-1',
      status: 'RUNNING',
      currentStage: 'INGESTION',
      profileSnapshot: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const job = getBaseJob();
    const result = await evaluateCandidateFit(nullRunId, 'job-6', job);
    expect(result).toBeNull(); // Should be fully skipped

    await db.delete(schema.runs).where(eq(schema.runs.id, nullRunId));
  });

  it('12. Determinism - identical output', async () => {
    await insertTestJob('job-7');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 5 },
      description: { requiredSkills: ['typescript'] }
    });

    const r1 = await evaluateCandidateFit(runId, 'job-7', job);
    const r2 = await evaluateCandidateFit(runId, 'job-7', job);
    
    expect(r1).toEqual(r2); // Same inputs => exact same outputs
  });

  it('15-17. Bounded Score 0-100', async () => {
    await insertTestJob('job-8');
    // Perfect
    let job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 0 },
      description: { requiredSkills: ['typescript'] }
    });
    let result = await evaluateCandidateFit(runId, 'job-8', job);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.score).toBeGreaterThanOrEqual(0);

    await insertTestJob('job-9');
    // Terrible
    job = getBaseJob({
      job: { title: 'Astronaut', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 20 },
      description: { requiredSkills: ['flying', 'space', 'c++'] }
    });
    result = await evaluateCandidateFit(runId, 'job-9', job);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.score).toBeGreaterThanOrEqual(0);
  });

  describe('D1.7.4-H1 Idempotency & Persistence', () => {
    it('1 & 2 & 3. Repeated execution reuses row idempotently', async () => {
      await insertTestJob('job-idem-1');
      const job = getBaseJob({ job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' }});
      
      // First run
      await evaluateCandidateFit(runId, 'job-idem-1', job);
      let results = await db.select().from(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, runId)).all();
      expect(results.length).toBe(1);
      const firstId = results[0]!.id;

      // Second run (same runId, same jobId)
      await evaluateCandidateFit(runId, 'job-idem-1', job);
      results = await db.select().from(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, runId)).all();
      expect(results.length).toBe(1); // STILL 1
      expect(results[0]!.id).toBe(firstId); // REUSED ROW
    });

    it('4. Same job across different runs produces different rows', async () => {
      await insertTestJob('job-idem-2');
      const job = getBaseJob({ job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' }});
      
      const run2Id = crypto.randomUUID();
      await db.insert(schema.runs).values({
        id: run2Id,
        configId: 'fit-config-1',
        status: 'RUNNING',
        currentStage: 'INGESTION',
        profileSnapshot: { profileId: 'fit-prof-1', profileName: 'Test', snapshotAt: new Date().toISOString(), profile: {} },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await evaluateCandidateFit(runId, 'job-idem-2', job);
      await evaluateCandidateFit(run2Id, 'job-idem-2', job);

      const run1Results = await db.select().from(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, runId)).all();
      const run2Results = await db.select().from(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, run2Id)).all();
      
      expect(run1Results.length).toBe(1);
      expect(run2Results.length).toBe(1);

      await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, run2Id));
      await db.delete(schema.runs).where(eq(schema.runs.id, run2Id));
    });

    it('5. Different jobs within same run produce different rows', async () => {
      await insertTestJob('job-idem-3');
      await insertTestJob('job-idem-4');
      const job = getBaseJob({ job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' }});

      await evaluateCandidateFit(runId, 'job-idem-3', job);
      await evaluateCandidateFit(runId, 'job-idem-4', job);

      const results = await db.select().from(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, runId)).all();
      expect(results.length).toBe(2);
    });
  });
});
