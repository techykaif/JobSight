import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../lib/db/client.js';
import * as repos from '../lib/db/repositories/index.js';

describe('Database Null/Unknown Semantics', () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('persists and retrieves unknown values as explicitly null, not fabricated defaults', async () => {
    const jobId = crypto.randomUUID();

    // Create job with explicit nulls for unknowns
    await repos.upsertJob({
      id: jobId,
      canonicalUrl: `https://example.com/job-${jobId}`,
      canonicalTitle: 'Mystery Job',
      salaryMin: null, // Unknown
      salaryMax: null,
      remoteType: null, // Unknown
      experienceMin: null, // Unknown
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'UNKNOWN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Retrieve the job
    const result = await repos.queryJobWithRelatedCompany(jobId);
    
    expect(result).toBeDefined();
    const job = result!.job;
    
    // Ensure they are null, not 0, false, or 'ONSITE'
    expect(job.salaryMin).toBeNull();
    expect(job.salaryMax).toBeNull();
    expect(job.remoteType).toBeNull();
    expect(job.experienceMin).toBeNull();
  });
});
