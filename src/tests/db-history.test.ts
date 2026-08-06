import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../lib/db/client.js';
import * as repos from '../lib/db/repositories/index.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Database History Preservation', () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('preserves multiple observations for the same job without overwriting', async () => {
    const jobId = crypto.randomUUID();

    // 1. Create canonical job
    await repos.upsertJob({
      id: jobId,
      canonicalUrl: `https://example.com/job-${jobId}`,
      canonicalTitle: 'Test Job',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Observation 1: salary unknown
    await repos.createJobObservation({
      id: crypto.randomUUID(),
      jobId,
      observedAt: '2023-01-01T12:00:00Z',
      status: 'Active',
      salaryMin: null
    });

    // 3. Observation 2: salary discovered later
    await repos.createJobObservation({
      id: crypto.randomUUID(),
      jobId,
      observedAt: '2023-01-02T12:00:00Z',
      status: 'Active',
      salaryMin: 120000
    });

    // 4. Observation 3: job unavailable
    await repos.createJobObservation({
      id: crypto.randomUUID(),
      jobId,
      observedAt: '2023-01-03T12:00:00Z',
      status: 'Closed'
    });

    // Query all observations for this job
    const observations = await db.select().from(schema.jobObservations).where(eq(schema.jobObservations.jobId, jobId));
    
    expect(observations.length).toBe(3);
    
    // Assert order and preserved state
    const sorted = observations.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    expect(sorted[0]!.salaryMin).toBeNull();
    expect(sorted[0]!.status).toBe('Active');
    expect(sorted[1]!.salaryMin).toBe(120000);
    expect(sorted[2]!.status).toBe('Closed');
  });
});
