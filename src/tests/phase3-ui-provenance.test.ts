import { describe, it, expect, beforeAll, vi } from 'vitest';
import util from 'util';
import crypto from 'crypto';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { persistCandidateJob } from '../lib/jobs/persist.js';
import BoardPage from '../app/board/page.js';
import JobDetailsPage from '../app/jobs/[id]/page.js';

describe('Phase 3 - UI Provenance and Decision Authority', () => {
  beforeAll(() => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  });

  it('Provenance: Discovery values are correctly stored in Original fields and are unmodified by later enrichment', async () => {
    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({ id: configId, targetRoles: [], alternativeRoles: [], createdAt: '', updatedAt: '' });
    await db.insert(schema.runs).values({ id: runId, configId, status: 'RUNNING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    // Step 1: Initial discovery
    const { job } = await persistCandidateJob(runId, {
      company: { name: 'Provenance Corp' },
      job: { title: 'Provenance Engineer', url: 'https://prov.com/job', status: 'ACTIVE' },
      compensation: { salaryMin: 100000, salaryMinOriginal: 100000, currency: 'USD' },
      experience: { minYears: 3, maxYears: 5 },
      description: { summary: 'Original summary', requiredSkills: ['A'], preferredSkills: ['B'] },
      sources: []
    });

    expect(job.experienceMinOriginal).toBe(3);
    expect(job.experienceMaxOriginal).toBe(5);
    expect(job.experienceMin).toBe(3);
    expect(job.descriptionOriginal).toContain('Original summary');
    expect(job.descriptionOriginal).toContain('A');

    // Step 2: Enrichment simulating changing values
    // In actual system orchestrator.ts does this, but we simulate what it writes
    await db.update(schema.jobs).set({
      experienceMin: 6,
      experienceMax: 8,
      description: JSON.stringify({ summary: 'Enriched summary', requiredSkills: ['C'] })
    }).where(eq(schema.jobs.id, job.id));

    // Wait, persistCandidateJob might be called again if it's re-discovered
    const { job: reUpserted } = await persistCandidateJob(runId, {
      company: { name: 'Provenance Corp' },
      job: { title: 'Provenance Engineer', url: 'https://prov.com/job', status: 'ACTIVE' },
      compensation: { salaryMin: 120000 },
      experience: { minYears: undefined }, // ATS didn't provide this time
      description: undefined
    });

    // Original should NOT be overwritten by null or by the enriched values
    expect(reUpserted.experienceMinOriginal).toBe(3);
    expect(reUpserted.experienceMaxOriginal).toBe(5);
    expect(reUpserted.descriptionOriginal).toContain('Original summary');
  });

  it('Decision Presentation: UI components correctly use candidateDecisions and not intermediate decisions', async () => {
    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({ id: configId, targetRoles: [], alternativeRoles: [], createdAt: '', updatedAt: '' });
    await db.insert(schema.runs).values({ id: runId, configId, status: 'RUNNING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    // Job 1: Final INELIGIBLE + Qual CONSIDER + B7 RESEARCH_MORE
    const j1 = await persistCandidateJob(runId, {
      company: { name: 'Contradiction Corp' },
      job: { title: 'Geographic Veto Job', url: 'https://geo.com/job', status: 'ACTIVE' }
    });

    await db.insert(schema.decisions).values({ id: crypto.randomUUID(), runId, jobId: j1.job.id, decision: 'CONSIDER', createdAt: '' });
    await db.insert(schema.decisionResults).values({ id: crypto.randomUUID(), runId, jobId: j1.job.id, decision: 'RESEARCH_MORE', createdAt: '', updatedAt: '' });
    await db.insert(schema.candidateDecisions).values({ id: crypto.randomUUID(), runId, jobId: j1.job.id, finalDecision: 'INELIGIBLE', primaryReason: 'Geographic eligibility restriction.', createdAt: '' });

    // Job 2: Missing candidateDecision (legacy)
    const j2 = await persistCandidateJob(runId, {
      company: { name: 'Legacy Corp' },
      job: { title: 'Legacy Job', url: 'https://legacy.com/job', status: 'ACTIVE' }
    });
    await db.insert(schema.decisions).values({ id: crypto.randomUUID(), runId, jobId: j2.job.id, decision: 'CONSIDER', createdAt: '' });
    // Check JobDetail HTML output
    const job1Details = await JobDetailsPage({ params: Promise.resolve({ id: j1.job.id }) });
    const j1Html = util.inspect(job1Details, { depth: null });
    
    expect(j1Html).toContain('INELIGIBLE');
    expect(j1Html).toContain('Geographic eligibility restriction.');
    expect(j1Html).not.toContain('RESEARCH_MORE'); 

    const job2Details = await JobDetailsPage({ params: Promise.resolve({ id: j2.job.id }) });
    const j2Html = util.inspect(job2Details, { depth: null });
    
    expect(j2Html).toContain('PENDING');
  });
});
