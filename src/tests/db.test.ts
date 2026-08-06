import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../lib/db/client.js';
import * as repos from '../lib/db/repositories/index.js';

describe('Database Integration Lifecycle', () => {
  beforeAll(() => {
    // Run migrations on the in-memory db
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('proves the miniature lifecycle of a job hunt mission', async () => {
    const configId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const companyId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();

    // 1. Create hunt configuration
    await repos.saveHuntConfig({
      id: configId,
      targetRoles: JSON.stringify(['Software Engineer']),
      alternativeRoles: JSON.stringify([]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Create run
    await repos.createRun({
      id: runId,
      configId,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 3. Create company
    await repos.upsertCompany({
      id: companyId,
      normalizedName: 'openai',
      displayName: 'OpenAI',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 4. Create job
    await repos.upsertJob({
      id: jobId,
      companyId,
      canonicalTitle: 'Software Engineer',
      canonicalUrl: 'https://openai.com/jobs/123',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 5. Create observation
    await repos.createJobObservation({
      id: crypto.randomUUID(),
      jobId,
      runId,
      observedAt: new Date().toISOString(),
      status: 'Active'
    });

    // 6. Attach source
    await repos.saveSource({
      id: sourceId,
      jobId,
      sourceUrl: 'https://openai.com/jobs/123',
      sourceType: 'OFFICIAL_JOB_PAGE',
      retrievedAt: new Date().toISOString()
    });

    // 7. Attach evidence
    await repos.saveEvidence({
      id: crypto.randomUUID(),
      runId,
      sourceId,
      entityType: 'JOB',
      entityId: jobId,
      field: 'salaryMin',
      valueRepresentation: '150000',
      evidenceExcerpt: '$150k - $200k',
      evidenceType: 'FACT',
      createdAt: new Date().toISOString()
    });

    // 8. Save raw research artifact
    await repos.saveResearchArtifact({
      id: crypto.randomUUID(),
      runId,
      entityType: 'JOB',
      entityId: jobId,
      workerType: 'AGY_UNSTRUCTURED_FETCH',
      rawContent: 'Software Engineer at OpenAI...',
      createdAt: new Date().toISOString()
    });

    // 9. Save analysis
    await repos.saveAnalysis({
      id: crypto.randomUUID(),
      jobId,
      runId,
      experienceFlexibility: 'High',
      analysisTimestamp: new Date().toISOString()
    });

    // 10. Save score
    await repos.saveScore({
      id: crypto.randomUUID(),
      jobId,
      runId,
      scoreType: 'RESUME_MATCH',
      scoreValue: 95,
      scoringVersion: '1.0.0',
      createdAt: new Date().toISOString()
    });

    // 11. Save pipeline event
    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      eventType: 'JOB_VERIFIED',
      entityType: 'JOB',
      entityId: jobId
    });

    // 12. Query the resulting opportunity
    const result = await repos.queryJobWithRelatedCompany(jobId);
    expect(result).toBeDefined();
    expect(result?.job.id).toBe(jobId);
    expect(result?.company?.normalizedName).toBe('openai');
  });
});
