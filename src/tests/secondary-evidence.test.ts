import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSecondaryEvidence } from '../lib/pipeline/secondary-evidence.js';
import { SearchEngineProvider } from '../lib/discovery/providers/SearchEngineProvider.js';

// Mock the external provider
vi.mock('../lib/discovery/providers/SearchEngineProvider.js');

describe('Secondary Evidence Pipeline', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const baseJob: any = {
    companyName: 'Acme Corp',
    title: 'Senior Engineer',
    location: 'Remote',
    sourceUrl: 'https://acme.com/jobs/123'
  };

  it('positive match when unstructuredText contains company and title', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      unstructuredText: 'Some page mentioning Acme Corp looking for a Senior Engineer right now.',
      latencyMs: 10
    });

    const result = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');

    expect(result.status).toBe('OBSERVED_ON_SOURCE');
    expect(result.targetSource).toBe('SEARCH_ENGINE');
    expect(result.checkQuery).toContain('Acme Corp');
    expect(result.checkQuery).toContain('Senior Engineer');
    expect(result.checkQuery).toContain('-site:acme.com');
  });

  it('genuine non-observation when text misses company or title', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      unstructuredText: 'Some unrelated page mentioning Acme Corp but NOT the title.',
      latencyMs: 10
    });

    const result = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');

    expect(result.status).toBe('NOT_OBSERVED_ON_CHECKED_SOURCE');
    expect(result.checkQuery).toBeDefined();
  });

  it('provider failure cascades to UNKNOWN propagation', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockRejectedValue(new Error('Network error'));

    const result = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');

    expect(result.status).toBe('UNKNOWN');
    expect(result.checkQuery).toContain('Acme Corp'); // Still returns the query attempted
  });

  it('malformed provider response yields UNKNOWN', async () => {
    vi.mocked(SearchEngineProvider.prototype.discover).mockResolvedValue({
      jobs: [],
      // Missing unstructuredText entirely
      latencyMs: 10
    });

    const result = await checkSecondaryEvidence(baseJob, 'GREENHOUSE');

    expect(result.status).toBe('UNKNOWN');
  });

  it('independence guard blocks if originating provider is SEARCH_ENGINE', async () => {
    const result = await checkSecondaryEvidence(baseJob, 'SEARCH_ENGINE');

    expect(result.status).toBe('UNKNOWN');
    expect(result.checkQuery).toBe('SKIPPED_SAME_PROVIDER');
    
    // Ensure discover wasn't even called
    expect(SearchEngineProvider.prototype.discover).not.toHaveBeenCalled();
  });
  
  it('ambiguous or empty job fields yield UNKNOWN without querying', async () => {
    const emptyJob: any = { companyName: '', title: '' };
    const result = await checkSecondaryEvidence(emptyJob, 'GREENHOUSE');
    
    expect(result.status).toBe('UNKNOWN');
    expect(SearchEngineProvider.prototype.discover).not.toHaveBeenCalled();
  });
});
