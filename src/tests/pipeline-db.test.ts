import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../lib/db/client.js';
import { eq } from 'drizzle-orm';
import * as repos from '../lib/db/repositories/index.js';
import * as schema from '../lib/db/schema.js';
import { persistCandidateJob } from '../lib/jobs/persist.js';
import type { CandidateJob } from '../lib/jobs/extractionSchema.js';

describe('Pipeline Persistence Idempotency', () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('preserves canonical jobs and creates new observations on duplicate upsert', async () => {
    const runId1 = crypto.randomUUID();
    const runId2 = crypto.randomUUID();

    const configId = crypto.randomUUID();
    await repos.saveHuntConfig({ id: configId, targetRoles: '[]', alternativeRoles: '[]', createdAt: '', updatedAt: '' });
    await repos.createRun({ id: runId1, configId, status: 'RUNNING', createdAt: '', updatedAt: '' });
    await repos.createRun({ id: runId2, configId, status: 'RUNNING', createdAt: '', updatedAt: '' });

    const candidate: CandidateJob = {
      company: { name: 'Idempotency Corp' },
      job: { title: 'Idempotency Engineer', url: 'https://idem.com/job', status: 'ACTIVE' },
      compensation: { salaryMin: null },
      description: { summary: 'Job description' },
      sources: [{ url: 'https://idem.com/job', type: 'OFFICIAL_JOB_PAGE' }],
      evidence: []
    };

    // First persistence (Run 1)
    const { job: job1 } = await persistCandidateJob(runId1, candidate);

    // Second persistence (Run 2) with slight update (status changed)
    const updatedCandidate = { ...candidate, job: { ...candidate.job, status: 'INACTIVE' as const } };
    const { job: job2 } = await persistCandidateJob(runId2, updatedCandidate);

    // Assert canonical job deduplicated
    expect(job1.id).toBe(job2.id); // Same canonical ID
    expect(job2.status).toBe('INACTIVE'); // Field updated

    // Assert observations were created properly
    const observations = await db.select().from(schema.jobObservations).where(
      eq(schema.jobObservations.jobId, job1.id)
    );

    expect(observations.length).toBe(2);
    expect(observations[0]!.runId).toBe(runId1);
    expect(observations[1]!.runId).toBe(runId2);
  });
});
