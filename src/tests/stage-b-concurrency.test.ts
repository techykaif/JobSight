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

vi.mock('../lib/agy/runner.js', () => ({
  runAgyTask: vi.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { candidates: [{ company: { name: 'MockCo' }, job: { title: 'MockJob' } }] };
  }),
  runAgyUnstructured: vi.fn()
}));

import { runAgyTask, runAgyUnstructured } from '../lib/agy/runner.js';
import * as repos from '../lib/db/repositories/index.js';
import { runIngestionPipeline } from '../lib/pipeline/ingestion.js';

describe('Stage B Concurrency Stress Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a very large markdown string using bounded concurrency (MAX=2)', async () => {
    let massiveMarkdown = '';
    for (let i = 0; i < 2400; i++) {
      massiveMarkdown += `Company: TechCorp ${i}\nJob Title: SWE ${i}\nRequirements: Node, React\n\n`;
    }
    
    vi.mocked(runAgyUnstructured).mockResolvedValue(massiveMarkdown);

    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();

    await runIngestionPipeline(runId, {
      id: configId,
      targetRoles: ['SWE'],
      alternativeRoles: [],
      candidateCountry: 'India',
      searchScope: 'LOCAL_AND_GLOBAL'
    });

    // Verify STAGE_B_TELEMETRY event
    const telemetryCalls = vi.mocked(repos.saveEvent).mock.calls.filter(
      (call) => call[0].eventType === 'STAGE_B_TELEMETRY'
    );
    expect(telemetryCalls.length).toBe(1);
    
    const telemetry = telemetryCalls[0]![0].payload as any;
    expect(telemetry.success).toBe(true);
    expect(telemetry.chunksCreated).toBeGreaterThan(15);
    expect(telemetry.chunksCompleted).toBe(telemetry.chunksCreated);
    expect(telemetry.peakAgyProcesses).toBeLessThanOrEqual(2);
    expect(telemetry.activeChunkWorkers).toBeLessThanOrEqual(2);
    expect(telemetry.queueWaitTime).toBeGreaterThan(0);
  }, 15000);
});
