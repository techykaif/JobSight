import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

import { runAgyTask } from '../lib/agy/runner.js';
vi.mock('../lib/agy/runner.js', () => ({
  runAgyTask: vi.fn(),
  checkAgyAvailability: async () => true
}));

import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, sql } from 'drizzle-orm';
import { runMission } from '../lib/pipeline/orchestrator.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HTML Enrichment Pipeline Data Flow', () => {
  let runId: string;
  let jobId: string;
  let configId: string;
  let profileId: string;
  let companyId: string;

  beforeAll(() => { migrate(db, { migrationsFolder: "src/lib/db/migrations" }); });
  beforeEach(async () => {
    vi.resetAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html><body>Verified Enriched Source HTML</body></html>'
    } as Response);

    runId = crypto.randomUUID();
    jobId = crypto.randomUUID();
    configId = crypto.randomUUID();
    companyId = crypto.randomUUID();
    profileId = crypto.randomUUID();

    await db.insert(schema.profiles).values({
      id: profileId,
      name: "Enrichment Test",
      targetRoles: ["SE"] as any,
      skills: ["EnrichedSkill1"] as any,
      yearsOfProfessionalExperience: 6,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ["SE"],
      alternativeRoles: [],
      candidateCountry: "United States",
      remoteRequirement: "REMOTE_ONLY",
      requireSalaryDisclosure: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.runs).values({
      id: runId,
      configId,
      status: 'RUNNING',
      currentStage: 'DISCOVERY',
      lastCheckpoint: 'DISCOVERY_COMPLETED',
      profileSnapshot: { profileName: 'Enrichment Test', profileId, profile: { targetRoles: ["SE"], skills: ["EnrichedSkill1"], yearsOfProfessionalExperience: 6 } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.companies).values({
      id: companyId,
      normalizedName: 'comp' + crypto.randomUUID(),
      displayName: 'Comp1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobs).values({
      id: jobId,
      companyId,
      canonicalUrl: 'https://test.com/job',
      canonicalTitle: 'Software Engineer',
      status: 'ACTIVE',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await db.insert(schema.jobObservations).values({
      id: crypto.randomUUID(),
      runId,
      jobId,
      observedAt: new Date().toISOString(),
      status: 'ACTIVE'
    });

    await db.insert(schema.jobSources).values({
      id: crypto.randomUUID(),
      jobId,
      sourceUrl: 'https://test.com/job',
      sourceType: 'OFFICIAL_JOB_PAGE',
      retrievedAt: new Date().toISOString()
    });
  });

  afterEach(async () => {
    db.run(sql`PRAGMA foreign_keys = OFF`);
    for (const key of Object.keys(schema)) {
      const table = (schema as any)[key];
      if (table && table._ && table._.name) {
        try { await db.delete(table); } catch(e) { console.error("DELETE ERROR:", e); }
      }
    }
    db.run(sql`PRAGMA foreign_keys = ON`);
  });


  it('Data Lineage: HTML enrichment does not overwrite Original fields and preserves existing data on null/empty returns', async () => {
    // MOST IMPORTANT REGRESSION: Initial state with 80000
    await db.update(schema.jobs).set({
      salaryMinOriginal: 80000,
      salaryMin: 80000,
      salaryMaxOriginal: 100000,
      salaryMax: 100000,
      salaryCurrencyOriginal: 'USD',
      salaryCurrency: 'USD',
      salaryPeriodOriginal: 'YEARLY',
      salaryPeriod: 'YEARLY',
      location: 'New York',
      remoteType: 'ONSITE',
      employmentType: 'FULL_TIME',
      experienceMin: 2,
      description: JSON.stringify({ requiredSkills: ['React', 'Node'] }),
      canonicalUrl: 'https://test.com/job/original1'
    }).where(eq(schema.jobs.id, jobId));

    (runAgyTask as any).mockResolvedValueOnce({
      jobDescription: "This is a strictly enriched description.",
      salaryMin: 95000,
      salaryMax: 120000,
      salaryCurrency: "EUR",
      salaryPeriod: "MONTHLY",
      remoteType: "REMOTE",
      location: "United States",
      employmentType: "CONTRACT",
      requiredSkills: ["EnrichedSkill1", "EnrichedSkill2"],
      preferredSkills: [],
      experienceMin: 5,
      experienceMax: 10
    });

    const ac = new AbortController();
    await runMission(runId, ac.signal, () => false);

    const job = (await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)))[0];

    // Original fields remain unchanged
    expect(job!.salaryMinOriginal).toBe(80000);
    expect(job!.salaryMaxOriginal).toBe(100000);
    expect(job!.salaryCurrencyOriginal).toBe('USD');
    expect(job!.salaryPeriodOriginal).toBe('YEARLY');
    expect(job!.canonicalUrl).toMatch(/https:\/\/test\.com\/job\/original/);

    // Current fields are updated
    expect(job!.salaryMin).toBe(95000);
    expect(job!.salaryMax).toBe(120000);
    expect(job!.salaryCurrency).toBe('EUR');
    expect(job!.salaryPeriod).toBe('MONTHLY');
    expect(job!.remoteType).toBe('REMOTE');
    expect(job!.location).toBe('United States');
    expect(job!.employmentType).toBe('CONTRACT');
    expect(job!.experienceMin).toBe(5);

    // Downstream consumers get enriched info
    expect(job!.candidateRemoteEligibility).toBe("ELIGIBLE"); // B6 remote check passed

    const desc = JSON.parse(job!.description as string);
    expect(desc.requiredSkills).toContain("EnrichedSkill1"); // Candidate fit input

    // Provenance invariants
    const sources = await db.select().from(schema.jobSources).where(eq(schema.jobSources.jobId, jobId));
    expect(sources.length).toBe(1);
    const artifacts = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.entityId, jobId));
    expect(artifacts.length).toBeGreaterThan(0);
  });

  it('Data Lineage: HTML enrichment null/empty/undefined preserves existing data exactly', async () => {
    // Initial state with 80000
    await db.update(schema.jobs).set({
      salaryMinOriginal: 80000,
      salaryMin: 80000,
      salaryMaxOriginal: 100000,
      salaryMax: 100000,
      salaryCurrencyOriginal: 'USD',
      salaryCurrency: 'USD',
      salaryPeriodOriginal: 'YEARLY',
      salaryPeriod: 'YEARLY',
      location: 'New York',
      remoteType: 'ONSITE',
      employmentType: 'FULL_TIME',
      experienceMin: 2,
      description: JSON.stringify({ requiredSkills: ['React', 'Node'] }),
      canonicalUrl: 'https://test.com/job/original2'
    }).where(eq(schema.jobs.id, jobId));

    (runAgyTask as any).mockResolvedValueOnce({
      jobDescription: "   ", // whitespace only
      salaryMin: null, // null
      salaryMax: undefined, // undefined
      salaryCurrency: "", // empty string
      salaryPeriod: "   ", // whitespace only
      remoteType: null,
      location: "",
      employmentType: undefined,
      requiredSkills: [], // empty array
      preferredSkills: null,
      experienceMin: null,
      experienceMax: undefined
    });

    const ac = new AbortController();
    await runMission(runId, ac.signal, () => false);

    const job = (await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)))[0];

    // Everything should remain untouched
    expect(job!.salaryMinOriginal).toBe(80000);
    expect(job!.salaryMin).toBe(80000);
    expect(job!.salaryMaxOriginal).toBe(100000);
    expect(job!.salaryMax).toBe(100000);
    expect(job!.salaryCurrencyOriginal).toBe('USD');
    expect(job!.salaryCurrency).toBe('USD');
    expect(job!.salaryPeriodOriginal).toBe('YEARLY');
    expect(job!.salaryPeriod).toBe('YEARLY');

    expect(job!.location).toBe('New York');
    expect(job!.remoteType).toBe('ONSITE');
    expect(job!.employmentType).toBe('FULL_TIME');
    expect(job!.experienceMin).toBe(2);

    const desc = JSON.parse(job!.description as string);
    expect(desc.requiredSkills).toContain('React');
    expect(desc.requiredSkills.length).toBe(2);
  });

});
