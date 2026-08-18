import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { SearchEngineProvider } from '../lib/discovery/providers/SearchEngineProvider.js';
import * as persist from '../lib/jobs/persist.js';
import * as orchestrator from '../lib/pipeline/orchestrator.js';
import * as runner from '../lib/agy/runner.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

vi.mock('../lib/agy/runner.js', () => ({
  runAgyUnstructured: vi.fn(),
}));

describe('Mission Compliance Tests', () => {
  beforeEach(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    await db.delete(schema.runs);
    await db.delete(schema.jobs);
    await db.delete(schema.jobSources);
    await db.delete(schema.researchArtifacts);
    await db.delete(schema.companies);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('A. Vertex redirect -> real destination URL', async () => {
    const provider = new SearchEngineProvider();
    vi.mocked(runner.runAgyUnstructured).mockResolvedValueOnce('Here is a job: https://vertexaisearch.cloud.google.com/grounding-api-redirect?xyz');
    
    const mockFetch = vi.fn().mockResolvedValueOnce({
      url: 'https://realcompany.com/jobs/123',
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    });
    global.fetch = mockFetch;

    const res = await provider.discover({
      runId: 'mock-run',
      sourceUrl: 'SEARCH_ENGINE',
      targetRoles: ['Engineer'],
      alternativeRoles: [],
      location: 'NY',
      remoteOnly: false
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(res.unstructuredText).toContain('https://realcompany.com/jobs/123');
    expect(res.unstructuredText).not.toContain('vertexaisearch.cloud.google.com');
  });

  it('B. Normal URL -> no unnecessary resolution', async () => {
    const provider = new SearchEngineProvider();
    vi.mocked(runner.runAgyUnstructured).mockResolvedValueOnce('Here is a job: https://normalcompany.com/careers/456');
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const res = await provider.discover({
      runId: 'mock-run',
      sourceUrl: 'SEARCH_ENGINE',
      targetRoles: ['Engineer'],
      alternativeRoles: [],
      location: 'NY',
      remoteOnly: false
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.unstructuredText).toContain('https://normalcompany.com/careers/456');
  });

  it('D/E. Identity and Deduplication edge cases', async () => {
    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();
    await (await import('../lib/db/repositories/index.js')).saveHuntConfig({ id: configId, targetRoles: '[]', alternativeRoles: '[]', location: '', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
    await (await import('../lib/db/repositories/index.js')).createRun({ id: runId, configId, status: 'RUNNING', currentStage: 'DISCOVERY', profileSnapshot: '{}', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any);
    
    // Candidate 1: NY, no external ID
    const candidate1 = {
      job: { title: 'Software Engineer', location: 'NY', status: 'ACTIVE', url: 'https://comp.com/1' },
      company: { name: 'Comp', website: 'comp.com' },
      sources: [{ url: 'https://comp.com/1', type: 'CUSTOM' }]
    };
    const { job: job1 } = await persist.persistCandidateJob(runId, candidate1 as any);
    
    // Candidate 2: NY, explicit external ID
    const candidate2 = {
      job: { title: 'Software Engineer', location: 'NY', status: 'ACTIVE', url: 'https://comp.com/2', externalJobId: 'REQ-2' },
      company: { name: 'Comp', website: 'comp.com' },
      sources: [{ url: 'https://comp.com/2', type: 'CUSTOM', externalJobId: 'REQ-2' }]
    };
    const { job: job2 } = await persist.persistCandidateJob(runId, candidate2 as any);
    expect(job1.id).not.toBe(job2.id);

    // Candidate 3: SF, no external ID (Same title, different location)
    const candidate3 = {
      job: { title: 'Software Engineer', location: 'SF', status: 'ACTIVE', url: 'https://comp.com/3' },
      company: { name: 'Comp', website: 'comp.com' },
      sources: [{ url: 'https://comp.com/3', type: 'CUSTOM' }]
    };
    const { job: job3 } = await persist.persistCandidateJob(runId, candidate3 as any);
    expect(job1.id).not.toBe(job3.id);
  });

});
