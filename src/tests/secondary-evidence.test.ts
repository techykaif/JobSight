import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSecondaryEvidence, persistSecondaryEvidence } from '../lib/pipeline/secondary-evidence.js';
import { SearchEngineProvider } from '../lib/discovery/providers/SearchEngineProvider.js';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';

// Mock the external provider
vi.mock('../lib/discovery/providers/SearchEngineProvider.js');

describe('Bounded Secondary Evidence Pipeline', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const baseJob: any = {
    companyName: 'Acme Corp',
    title: 'Senior Engineer',
    location: 'Remote',
    sourceUrl: 'https://acme.com/jobs/123'
  };

  it('1. successful zero-result → NOT_OBSERVED_ON_CHECKED_SOURCES', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      unstructuredText: 'Some unrelated page mentioning Acme Corp but NOT the title.',
      latencyMs: 10
    });

    const results = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');

    expect(result!.status).toBe('NOT_OBSERVED_ON_CHECKED_SOURCES');
    expect(result!.checkQuery).toBeDefined();
    expect(result!.targetSource).toBe('SEARCH_ENGINE');
  });

  it('2. strong partial match → OBSERVED_ON_SOURCE', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      unstructuredText: '{"url":"https://linked.com/1","title":"Senior Engineer","company":"Acme Corp"}',
      latencyMs: 10
    });

    const results = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');

    expect(result!.status).toBe('OBSERVED_ON_SOURCE');
    expect(result!.matchStrength).toBe('PARTIAL');
    expect(result!.observedUrl).toBe('https://linked.com/1');
  });

  it('4. weak match (fuzzy text fallback) → UNKNOWN', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      unstructuredText: 'Some page mentioning Acme Corp looking for a Senior Engineer right now.',
      latencyMs: 10
    });

    const results = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');

    expect(result!.status).toBe('UNKNOWN');
    expect(result!.matchStrength).toBe('WEAK'); // Exposed but status is UNKNOWN
    expect(result!.targetSource).toBe('SEARCH_ENGINE');
  });

  it('7. provider failure → UNKNOWN propagation', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockRejectedValue(new Error('Network error'));

    const results = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');

    expect(result!.status).toBe('UNKNOWN');
  });

  it('9. malformed provider response yields UNKNOWN', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      // Missing unstructuredText entirely
    } as any);

    const results = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');

    expect(result!.status).toBe('UNKNOWN');
  });

  it('ambiguous or empty job fields yield UNKNOWN without querying', async () => {
    const emptyJob: any = { companyName: '', title: '' };
    const results = await checkSecondaryEvidence(emptyJob, 'GREENHOUSE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');

    expect(result!.status).toBe('UNKNOWN');
    expect(SearchEngineProvider.prototype.discover).not.toHaveBeenCalled();
  });

  it('independence guard blocks if originating provider is SEARCH_ENGINE', async () => {
    const results = await checkSecondaryEvidence(baseJob, 'SEARCH_ENGINE');
    const result = results.find(r => r.targetSource === 'SEARCH_ENGINE');
    expect(result!.status).toBe('UNKNOWN');
    expect(result!.checkQuery).toBe('SKIPPED_SAME_PROVIDER');
  });

  it('10/11. provenance and run isolation persistence', async () => {
    const mockDbInsert = vi.fn().mockReturnValue({ 
      values: vi.fn().mockReturnValue({ onConflictDoUpdate: vi.fn() }) 
    });
    (db as any).insert = mockDbInsert;
    
    await persistSecondaryEvidence('job123', 'run456', {
      status: 'NOT_OBSERVED_ON_CHECKED_SOURCES',
      targetSource: 'SEARCH_ENGINE',
      checkQuery: 'test query'
    });
    
    expect(mockDbInsert).toHaveBeenCalledWith(schema.jobCrossReferences);
  });
});
