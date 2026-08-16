import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

describe('Milestone 7: UI & Persistence Validation', () => {
  beforeAll(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('can persist and validate profile data', async () => {
    const profileId = crypto.randomUUID();
    const mockProfile = {
      id: profileId,
      name: 'Test Candidate',
      yearsOfProfessionalExperience: 5,
      education: 'BSc Computer Science',
      targetRoles: ['Frontend Engineer', 'Full Stack Engineer'],
      skills: ['React', 'TypeScript', 'Next.js'],
      projectExperience: ['Built a job board'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.insert(schema.profiles).values(mockProfile);

    const result = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
    expect(result.length).toBe(1);
    expect(result[0]!.name).toBe('Test Candidate');
    expect((result[0]!.targetRoles as string[]).includes('Frontend Engineer')).toBe(true);
  });

  it('can persist and validate hunt configuration data', async () => {
    const configId = crypto.randomUUID();
    const mockConfig = {
      id: configId,
      targetRoles: ['Backend Developer'],
      alternativeRoles: ['Software Engineer'],
      requiredSkills: ['Node.js', 'PostgreSQL'],
      salaryMinimum: 100000,
      remoteRequirement: 'REMOTE_ONLY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.insert(schema.huntConfigs).values(mockConfig);

    const result = await db.select().from(schema.huntConfigs).where(eq(schema.huntConfigs.id, configId)).limit(1);
    expect(result.length).toBe(1);
    expect(result[0]!.salaryMinimum).toBe(100000);
    expect((result[0]!.requiredSkills as string[]).includes('Node.js')).toBe(true);
  });

  it('can query dashboard summary data', async () => {
    // Ensure dashboard query doesn't throw
    const jobsCountRes = await db.select().from(schema.jobs).limit(1);
    expect(Array.isArray(jobsCountRes)).toBe(true);
  });

  it('handles unknown/null values safely in queries', async () => {
    const jobId = crypto.randomUUID();
    await db.insert(schema.jobs).values({ canonicalUrl: `https://example.com/job-${crypto.randomUUID()}`,
      id: jobId,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const job = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
    expect(job[0]!.salaryMin).toBeNull();
    expect(job[0]!.remoteType).toBeNull();
    
    // Test that the jobs explorer would safely render this
    const salaryText = job[0]!.salaryMin ? `$${job[0]!.salaryMin}` : 'Unknown';
    expect(salaryText).toBe('Unknown');
  });
});
