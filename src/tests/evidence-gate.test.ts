import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { runMission } from '../lib/pipeline/orchestrator.js';

describe('Evidence Gate Regression Tests', () => {
  let runId1: string;
  let runId2: string;

  beforeAll(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });

    const configId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ['Engineer'],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const profileId = crypto.randomUUID();
    await db.insert(schema.profiles).values({
      id: profileId,
      name: 'Test Profile',
      yearsOfProfessionalExperience: 5,
      targetRoles: ['Engineer'],
      skills: ['TypeScript'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).onConflictDoNothing();

    runId1 = crypto.randomUUID();
    runId2 = crypto.randomUUID();

    const snapshot = {
      profileId,
      profileName: 'Test Profile',
      snapshotAt: new Date().toISOString(),
      profile: {
        yearsOfProfessionalExperience: 5,
        targetRoles: ['Engineer'],
        skills: ['TypeScript']
      }
    };

    await db.insert(schema.runs).values([
      { id: runId1, configId, status: 'CREATED', lastCheckpoint: 'DISCOVERY_COMPLETED', profileSnapshot: snapshot, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: runId2, configId, status: 'CREATED', lastCheckpoint: 'DISCOVERY_COMPLETED', profileSnapshot: snapshot, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);
  });

  it('1 & 2. Job with no research artifacts and no HTTP fetch receives SKIP and no optimistic 100/100 score', async () => {
    const jobId = crypto.randomUUID();
    const companyId = crypto.randomUUID();

    await db.insert(schema.companies).values({
      id: companyId,
      displayName: 'NoEvidence Corp',
      normalizedName: 'noevidence corp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobs).values({
      id: jobId,
      companyId,
      canonicalTitle: 'Engineer',
      canonicalUrl: 'https://example.com/job1',
      status: 'ACTIVE',
      description: JSON.stringify({ text: 'A small snippet.' }),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobObservations).values({
      id: crypto.randomUUID(),
      runId: runId1,
      jobId,
      observedAt: new Date().toISOString()
    });

    // No artifact and no jobSources for this job

    const ac = new AbortController();

    // We only want to run Qualification, so we cheat by setting lastCheckpoint to skip Discovery
    // The orchestrator will run QUALIFICATION because skipQualification=false when lastCheckpoint != 'QUALIFICATION_COMPLETED'
    // Let's run it briefly, then abort, or let it finish if it's mocked
    // Actually, `runMission` will try to run full pipeline.

    try {
      const p = runMission(runId1, ac.signal, () => false as any);
      setTimeout(() => ac.abort(), 2000); // Give it enough time to run qualification then abort before other slow steps
      await p;
    } catch (e: any) {
      if (e.name !== 'AbortError' && e.message !== 'Mission Cancelled') {
        console.error('Test 1 Error:', e);
      }
    }

    const dec = await db.select().from(schema.decisions).where(eq(schema.decisions.jobId, jobId)).limit(1);
    expect(dec.length).toBe(1);
    expect(dec[0]?.decision).toBe('SKIP');
    expect(dec[0]?.reasons).toContain('Insufficient verified source evidence.');

    const scores = await db.select().from(schema.scores).where(eq(schema.scores.jobId, jobId));
    // Since we output { resumeMatch: 0, requirementMatch: 0, opportunity: 0 } we will see zeroes instead of 100/100.
    const oppScore = scores.find(s => s.scoreType === 'OPPORTUNITY');
    expect(oppScore?.scoreValue).toBe(0);
  });

  it('3. Job with verified source content continues through qualification', async () => {
    const jobId = crypto.randomUUID();
    const companyId = crypto.randomUUID();

    await db.insert(schema.companies).values({
      id: companyId,
      displayName: 'Evidence Corp',
      normalizedName: 'evidence corp',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobs).values({
      id: jobId,
      companyId,
      canonicalTitle: 'Engineer',
      canonicalUrl: 'https://example.com/job2',
      status: 'ACTIVE',
      description: JSON.stringify({ text: 'Full description goes here with lots of requirements.' }),
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobObservations).values({
      id: crypto.randomUUID(),
      runId: runId2,
      jobId,
      observedAt: new Date().toISOString()
    });

    // Insert artifact
    await db.insert(schema.researchArtifacts).values({
      id: crypto.randomUUID(),
      runId: runId2,
      entityType: 'JOB',
      entityId: jobId,
      workerType: 'TEST',
      rawContent: 'This is the verified raw content from the job posting.',
      createdAt: new Date().toISOString()
    });

    const ac = new AbortController();
    try {
      const p = runMission(runId2, ac.signal, () => false as any);
      setTimeout(() => ac.abort(), 2000);
      await p;
    } catch (e: any) {
      if (e.name !== 'AbortError' && e.message !== 'Mission Cancelled') {
        console.error('Test 2 Error:', e);
      }
    }

    const dec = await db.select().from(schema.decisions).where(eq(schema.decisions.jobId, jobId)).limit(1);
    expect(dec.length).toBe(1);
    const reasons = dec[0]?.reasons as string[];
    expect(reasons).not.toContain('Insufficient verified source evidence.');
  });
});
