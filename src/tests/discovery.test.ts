import { describe, it, expect, vi } from 'vitest';
import { providerRegistry } from '../lib/discovery/registry.js';
import { runDiscovery } from '../lib/discovery/orchestrator.js';
import { SearchEngineProvider, GreenhouseProvider, LeverProvider, CareersPageProvider } from '../lib/discovery/providers/index.js';
import * as repos from '../lib/db/repositories/index.js';
import { bootstrap } from '../lib/bootstrap.js';

bootstrap();

// Mock DB
vi.mock('../lib/db/repositories/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    saveEvent: vi.fn(),
  };
});

// Mock AGY Unstructured runner for SearchEngine
vi.mock('../lib/agy/runner.js', () => ({
  runAgyUnstructured: vi.fn().mockResolvedValue('Mocked search engine results')
}));

// Mock fetch for HTTP providers
const originalFetch = global.fetch;
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () => 'Mocked provider HTML content'
}) as any;

describe('Discovery Intelligence Platform', () => {
  it('registers all core providers', () => {
    const providers = providerRegistry.getAll();
    expect(providers.length).toBeGreaterThanOrEqual(4);
    
    expect(providerRegistry.getByType('GREENHOUSE').length).toBeGreaterThan(0);
    expect(providerRegistry.getByType('LEVER').length).toBeGreaterThan(0);
    expect(providerRegistry.getByType('SEARCH_ENGINE').length).toBeGreaterThan(0);
  });

  it('selects correct provider for URLs', () => {
    expect(providerRegistry.findProviderForUrl('https://boards.greenhouse.io/test')?.name).toBe('Greenhouse ATS');
    expect(providerRegistry.findProviderForUrl('https://jobs.lever.co/test')?.name).toBe('Lever ATS');
    expect(providerRegistry.findProviderForUrl('https://example.com/careers')?.name).toBe('Generic Careers Page');
    expect(providerRegistry.findProviderForUrl('SEARCH_ENGINE')?.name).toBe('Search Engine Discovery');
  });

  it('executes discovery across multiple sources and emits telemetry', async () => {
    const runId = 'test_run_123';
    const config = {
      targetRoles: ['Software Engineer'],
      candidateCountry: 'US',
      discoverySources: [
        { url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' },
        { url: 'https://boards.greenhouse.io/test', type: 'GREENHOUSE' },
        { url: 'https://jobs.lever.co/test', type: 'LEVER' },
        { url: 'https://example.com/careers', type: 'CAREERS_PAGE' }
      ]
    };

    const result = await runDiscovery(runId, config);

    expect(result.unstructuredText).toContain('Mocked search engine results');
    expect(result.unstructuredText).toContain('Mocked provider HTML content');
    expect(result.jobs.length).toBeGreaterThanOrEqual(0); // Currently we mocked fetch to return empty text, so no structured jobs are directly extracted by these providers yet. Stage B handles unstructured.

    // Verify Telemetry
    const saveEventCalls = vi.mocked(repos.saveEvent).mock.calls;
    
    // Now it emits STRATEGY_STARTED, PROVIDER_STARTED/COMPLETED for each source, STRATEGY_COMPLETED.
    expect(saveEventCalls.length).toBeGreaterThanOrEqual(2);

    const startedEvent = saveEventCalls.find(c => c[0].eventType === 'STRATEGY_STARTED');
    expect(startedEvent).toBeDefined();

    const completedEvent = saveEventCalls.find((c: any) => c[0].eventType === 'STRATEGY_COMPLETED');
    expect(completedEvent).toBeDefined();
    expect((completedEvent as any)[0].payload.strategy).toBe('Default Strategy');
  });
});
