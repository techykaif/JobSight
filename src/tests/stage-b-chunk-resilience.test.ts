import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// We need to mock the DB before importing ingestion.ts to prevent DB errors in tests.
vi.mock('../lib/db/repositories/index.js', () => {
  return {
    saveEvent: vi.fn(),
    saveFailure: vi.fn(),
    saveJob: vi.fn(),
    saveCandidateReference: vi.fn(),
    saveResearchArtifact: vi.fn(),
  };
});

vi.mock('../lib/discovery/orchestrator.js', () => ({
  runDiscovery: vi.fn()
}));

vi.mock('../lib/agy/runner.js', () => ({
  runAgyTask: vi.fn(),
  runAgyUnstructured: vi.fn()
}));

vi.mock('../lib/jobs/persist.js', () => ({
  persistCandidateJob: vi.fn(async (runId, normalized) => ({ job: { id: crypto.randomUUID() }, company: { id: crypto.randomUUID() } }))
}));

vi.mock('../lib/candidate-fit/engine.js', () => ({
  evaluateCandidateFit: vi.fn(async () => ({ score: 90, level: 'EXCELLENT', scoreId: '1' }))
}));

import { runAgyTask } from '../lib/agy/runner.js';
import { runDiscovery } from '../lib/discovery/orchestrator.js';
import * as repos from '../lib/db/repositories/index.js';
import { bootstrap } from '../lib/bootstrap.js';

bootstrap();
import { runIngestionPipeline } from '../lib/pipeline/ingestion.js';

describe('Stage B Chunk Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const dummyConfig = {
    id: crypto.randomUUID(),
    targetRoles: ['SWE'],
    alternativeRoles: [],
    candidateCountry: 'India',
    searchScope: 'LOCAL_AND_GLOBAL',
    discoverySources: [{ url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' }]
  };

  const createLargeMarkdown = (numChunks: number) => {
    // 6000 chars is roughly the chunk boundary.
    // So 1 chunk is 6000 chars.
    let md = '';
    for (let i = 0; i < numChunks * 6000; i += 100) {
      md += `Dummy content for chunking. `.repeat(4) + '\n';
    }
    return md;
  };

  it('1. all chunks succeed', async () => {
    const rawResearch = createLargeMarkdown(3);
    vi.mocked(runDiscovery).mockResolvedValue({ jobs: [], unstructuredText: rawResearch } as any);
    
    vi.mocked(runAgyTask).mockResolvedValue({ candidates: [{ company: { name: 'Co1' }, job: { title: 'Job1', url: 'https://example.com/job/123' } }] });

    const res = await runIngestionPipeline(crypto.randomUUID(), dummyConfig as any, {} as any);
    
    expect(res.structured).toBeGreaterThan(0);
    expect(res.failed).toBe(0);
  });

  it('2. one chunk fails', async () => {
    const rawResearch = createLargeMarkdown(3); 
    vi.mocked(runDiscovery).mockResolvedValue({ jobs: [], unstructuredText: rawResearch } as any);
    
    let callCount = 0;
    vi.mocked(runAgyTask).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('AGY_SCHEMA_VALIDATION_FAILED: chunk 2 died');
      }
      return { candidates: [{ company: { name: `Co${callCount}` }, job: { title: `Job${callCount}`, url: 'https://example.com/job/123' } }] };
    });

    const res = await runIngestionPipeline(crypto.randomUUID(), dummyConfig as any, {} as any);
    
    expect(res.structured).toBe(callCount - 1); 
    expect(res.failed).toBe(0); // None failed persist stage
    
    const telemetryCalls = vi.mocked(repos.saveEvent).mock.calls.filter(
      (call) => call[0].eventType === 'STAGE_B_TELEMETRY'
    );
    expect(telemetryCalls.length).toBe(1);
    expect(telemetryCalls[0]![0].payload.success).toBe(true);
  });

  it('3. multiple chunks fail', async () => {
    const rawResearch = createLargeMarkdown(4);
    vi.mocked(runDiscovery).mockResolvedValue({ jobs: [], unstructuredText: rawResearch } as any);
    
    let callCount = 0;
    vi.mocked(runAgyTask).mockImplementation(async () => {
      callCount++;
      if (callCount === 2 || callCount === 3) {
        throw new Error('AGY_SCHEMA_VALIDATION_FAILED');
      }
      return { candidates: [{ company: { name: `Co${callCount}` }, job: { title: `Job${callCount}`, url: 'https://example.com/job/123' } }] };
    });

    const res = await runIngestionPipeline(crypto.randomUUID(), dummyConfig as any, {} as any);
    expect(res.structured).toBe(callCount - 2); 
  });

  it('4. all chunks fail', async () => {
    const rawResearch = createLargeMarkdown(2);
    vi.mocked(runDiscovery).mockResolvedValue({ jobs: [], unstructuredText: rawResearch } as any);
    
    vi.mocked(runAgyTask).mockRejectedValue(new Error('AGY_SCHEMA_VALIDATION_FAILED'));

    const res = await runIngestionPipeline(crypto.randomUUID(), dummyConfig as any, {} as any);
    
    // Batch resolves successfully (the ingestion phase didn't blow up entirely), 
    // but 0 candidates are returned because all chunks failed.
    expect(res.structured).toBe(0);
    
    const telemetryCalls = vi.mocked(repos.saveEvent).mock.calls.filter(
      (call) => call[0].eventType === 'STAGE_B_TELEMETRY'
    );
    expect(telemetryCalls.length).toBe(1);
    expect(telemetryCalls[0]![0].payload.success).toBe(true);
  });
});
