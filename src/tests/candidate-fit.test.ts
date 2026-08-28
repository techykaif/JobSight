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

  it('8. Missing job requirements (TEST 4 — Role-only Candidate Fit)', async () => {
    await insertTestJob('job-4');
    const job = getBaseJob({
      job: { title: 'Developer', url: 'http://test.com', status: 'ACTIVE' },
      description: { requiredSkills: [], preferredSkills: [] }
    });

    const result = await evaluateCandidateFit(runId, 'job-4', job);
    expect(result!.dimensions.experience).toBeNull();
    expect(result!.dimensions.skills).toBeNull();
    expect(result!.dimensions.role).toBe(100);
    // activeDimensions = 1
    expect(result!.level).toBe('insufficient_evidence');
  });

  it('10. Insufficient evidence (TEST 10 — No meaningful dimensions)', async () => {
    await insertTestJob('job-5');
    const job = getBaseJob({
      job: { title: 'Manager', url: 'http://test.com', status: 'ACTIVE' }
    });

    const result = await evaluateCandidateFit(runId, 'job-5', job);
    expect(result!.dimensions.role).toBe(0);
    expect(result!.dimensions.experience).toBeNull();
    expect(result!.dimensions.skills).toBeNull();
    expect(result!.level).toBe('insufficient_evidence');
  });

  it('TEST 5 — Skills-only Candidate Fit', async () => {
    await insertTestJob('job-t5');
    // Create a run with a profile that lacks target roles and experience
    const noExpRoleRunId = crypto.randomUUID();
    await db.insert(schema.runs).values({
      id: noExpRoleRunId,
      configId: 'fit-config-1',
      status: 'RUNNING',
      currentStage: 'INGESTION',
      profileSnapshot: {
        profileId: 'temp', profileName: 'temp', snapshotAt: new Date().toISOString(),
        profile: { skills: ['typescript'] } // ONLY skills
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const job = getBaseJob({
      job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' },
      description: { requiredSkills: ['typescript'] }
    });

    const result = await evaluateCandidateFit(noExpRoleRunId, 'job-t5', job);
    expect(result!.dimensions.skills).toBe(100);
    expect(result!.dimensions.experience).toBeNull();
    expect(result!.dimensions.role).toBeNull();
    // activeDimensions = 1
    expect(result!.level).toBe('insufficient_evidence');

    await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, noExpRoleRunId));
    await db.delete(schema.runs).where(eq(schema.runs.id, noExpRoleRunId));
  });

  it('TEST 6 — Experience-only Candidate Fit', async () => {
    await insertTestJob('job-t6');
    // Profile with ONLY experience
    const noRoleSkillRunId = crypto.randomUUID();
    await db.insert(schema.runs).values({
      id: noRoleSkillRunId,
      configId: 'fit-config-1',
      status: 'RUNNING',
      currentStage: 'INGESTION',
      profileSnapshot: {
        profileId: 'temp', profileName: 'temp', snapshotAt: new Date().toISOString(),
        profile: { yearsOfProfessionalExperience: 5 }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const job = getBaseJob({
      job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' },
      experience: { minYears: 3 }
    });

    const result = await evaluateCandidateFit(noRoleSkillRunId, 'job-t6', job);
    expect(result!.dimensions.experience).toBe(100);
    expect(result!.dimensions.skills).toBeNull();
    expect(result!.dimensions.role).toBeNull();
    // activeDimensions = 1
    expect(result!.level).toBe('insufficient_evidence');

    await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, noRoleSkillRunId));
    await db.delete(schema.runs).where(eq(schema.runs.id, noRoleSkillRunId));
  });

  it('TEST 7 — Role + Skills', async () => {
    await insertTestJob('job-t7');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      description: { requiredSkills: ['typescript'] },
      experience: {} // unknown
    });
    const result = await evaluateCandidateFit(runId, 'job-t7', job);
    expect(result!.dimensions.role).toBe(100);
    expect(result!.dimensions.skills).toBe(100);
    expect(result!.dimensions.experience).toBeNull();
    // activeDimensions = 2 => safe to evaluate
    expect(['strong', 'good']).toContain(result!.level);
  });

  it('TEST 8 — Role + Experience', async () => {
    await insertTestJob('job-t8');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      description: {}, // unknown skills
      experience: { minYears: 3 }
    });
    const result = await evaluateCandidateFit(runId, 'job-t8', job);
    expect(result!.dimensions.role).toBe(100);
    expect(result!.dimensions.experience).toBe(100);
    expect(result!.dimensions.skills).toBeNull();
    // activeDimensions = 2 => safe to evaluate
    expect(['strong', 'good']).toContain(result!.level);
  });

  it('TEST 9 — All three dimensions', async () => {
    await insertTestJob('job-t9');
    const job = getBaseJob({
      job: { title: 'Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      description: { requiredSkills: ['typescript'] },
      experience: { minYears: 3 }
    });
    const result = await evaluateCandidateFit(runId, 'job-t9', job);
    expect(result!.dimensions.role).toBe(100);
    expect(result!.dimensions.experience).toBe(100);
    expect(result!.dimensions.skills).toBe(100);
    // activeDimensions = 3
    expect(result!.level).toBe('strong');
  });

  it('TEST 15 — Senior title alone remains allowed', async () => {
    await insertTestJob('job-t15');
    const job = getBaseJob({
      job: { title: 'Senior Software Engineer', url: 'http://test.com', status: 'ACTIVE' },
      description: { requiredSkills: ['typescript'] }, // skills available => 2 dims
      experience: {} // no explicit experience
    });
    const result = await evaluateCandidateFit(runId, 'job-t15', job);
    expect(result!.dimensions.role).toBe(100); // Title should still match "Software Engineer" based on substring
    expect(result!.dimensions.skills).toBe(100);
    expect(result!.dimensions.experience).toBeNull();
    // Because it's 2 dimensions, it is evaluated normally, not rejected
    expect(['strong', 'good']).toContain(result!.level);
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

  describe('D1.7.4 Canonical Skill Matching Fixes (Phase 5)', () => {
    it('7. Java must NOT match JavaScript', async () => {
      await insertTestJob('job-fix-1');
      const noRoleSkillRunId = crypto.randomUUID();
      await db.insert(schema.runs).values({
        id: noRoleSkillRunId,
        configId: 'fit-config-1',
        status: 'RUNNING',
        currentStage: 'INGESTION',
        profileSnapshot: {
          profileId: 'temp', profileName: 'temp', snapshotAt: new Date().toISOString(),
          profile: { skills: ['JavaScript'] }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const job = getBaseJob({
        job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' },
        description: { requiredSkills: ['Java'] }
      });

      const result = await evaluateCandidateFit(noRoleSkillRunId, 'job-fix-1', job);
      expect(result!.matchedSkills).not.toContain('Java');
      expect(result!.missingSkills).toContain('Java');
      expect(result!.dimensions.skills).toBe(0);

      await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, noRoleSkillRunId));
      await db.delete(schema.runs).where(eq(schema.runs.id, noRoleSkillRunId));
    });

    it('8. React must NOT match React Native', async () => {
      await insertTestJob('job-fix-2');
      const run2Id = crypto.randomUUID();
      await db.insert(schema.runs).values({
        id: run2Id,
        configId: 'fit-config-1',
        status: 'RUNNING',
        currentStage: 'INGESTION',
        profileSnapshot: {
          profileId: 'temp', profileName: 'temp', snapshotAt: new Date().toISOString(),
          profile: { skills: ['React'] }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const job = getBaseJob({
        job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' },
        description: { requiredSkills: ['React Native'] }
      });

      const result = await evaluateCandidateFit(run2Id, 'job-fix-2', job);
      expect(result!.matchedSkills).not.toContain('React Native');
      expect(result!.dimensions.skills).toBe(0);

      await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, run2Id));
      await db.delete(schema.runs).where(eq(schema.runs.id, run2Id));
    });

    it('9. SQL must NOT match PostgreSQL', async () => {
      await insertTestJob('job-fix-3');
      const run3Id = crypto.randomUUID();
      await db.insert(schema.runs).values({
        id: run3Id,
        configId: 'fit-config-1',
        status: 'RUNNING',
        currentStage: 'INGESTION',
        profileSnapshot: {
          profileId: 'temp', profileName: 'temp', snapshotAt: new Date().toISOString(),
          profile: { skills: ['PostgreSQL'] }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const job = getBaseJob({
        job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' },
        description: { requiredSkills: ['SQL'] }
      });

      const result = await evaluateCandidateFit(run3Id, 'job-fix-3', job);
      expect(result!.matchedSkills).not.toContain('SQL');
      expect(result!.dimensions.skills).toBe(0);

      await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, run3Id));
      await db.delete(schema.runs).where(eq(schema.runs.id, run3Id));
    });

    it('12. Candidate technologies are included in Candidate Fit', async () => {
      await insertTestJob('job-fix-4');
      const run4Id = crypto.randomUUID();
      await db.insert(schema.runs).values({
        id: run4Id,
        configId: 'fit-config-1',
        status: 'RUNNING',
        currentStage: 'INGESTION',
        profileSnapshot: {
          profileId: 'temp', profileName: 'temp', snapshotAt: new Date().toISOString(),
          profile: { skills: ['JavaScript'], technologies: ['AWS'] }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const job = getBaseJob({
        job: { title: 'Engineer', url: 'http://test.com', status: 'ACTIVE' },
        description: { requiredSkills: ['AWS', 'JavaScript'] }
      });

      const result = await evaluateCandidateFit(run4Id, 'job-fix-4', job);
      expect(result!.matchedSkills).toContain('AWS');
      expect(result!.matchedSkills).toContain('JavaScript');
      expect(result!.dimensions.skills).toBe(100);

      await db.delete(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, run4Id));
      await db.delete(schema.runs).where(eq(schema.runs.id, run4Id));
    });
  });
});
