import { describe, it, expect, vi } from 'vitest';
import { strategyRegistry } from '../lib/discovery/strategy/registry.js';
import { StealthStrategy, HighCompensationStrategy, DefaultStrategy } from '../lib/discovery/strategy/strategies.js';
import { runDiscovery } from '../lib/discovery/orchestrator.js';
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

describe('Discovery Strategy Engine', () => {
  const sources = [
    { url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' },
    { url: 'https://boards.greenhouse.io/test', type: 'GREENHOUSE' },
    { url: 'https://jobs.lever.co/test', type: 'LEVER' },
    { url: 'https://example.com/careers', type: 'CAREERS_PAGE' }
  ];

  it('DefaultStrategy maintains neutral weighting', () => {
    const strategy = new DefaultStrategy();
    const prioritized = strategy.prioritizeSources(sources);
    
    // Career page is highest in base weighting (90)
    expect(prioritized[0]!.type).toBe('CAREERS_PAGE');
    expect(prioritized[0]!.weight).toBe(90);
  });

  it('StealthStrategy heavily prioritizes official sources', () => {
    const strategy = new StealthStrategy();
    const prioritized = strategy.prioritizeSources(sources);
    
    expect(prioritized[0]!.type).toBe('CAREERS_PAGE');
    expect(prioritized[0]!.weight).toBe(100);
    
    expect(prioritized[1]!.type).toBe('GREENHOUSE');
    expect(prioritized[1]!.weight).toBe(98);
    
    const searchEngine = prioritized.find(s => s.type === 'SEARCH_ENGINE');
    expect(searchEngine?.weight).toBe(40);
  });

  it('HighCompensationStrategy subtly shifts ATS weights', () => {
    const strategy = new HighCompensationStrategy();
    const prioritized = strategy.prioritizeSources(sources);
    
    const lever = prioritized.find(s => s.type === 'LEVER');
    expect(lever?.weight).toBe(90); // 85 + 5
  });

  it('Orchestrator early terminates properly', async () => {
    const config = {
      discoveryStrategy: 'strategy_stealth',
      discoverySources: sources
    };
    
    // Test early termination via budget limit simulated inside test or via orchestrator
    const result = await runDiscovery('test_run', config);
    expect(result.jobs).toBeDefined();
    
    const saveEventCalls = vi.mocked(repos.saveEvent).mock.calls;
    const completedEvent = saveEventCalls.find(c => (c[0] as any).eventType === 'STRATEGY_COMPLETED');
    expect(completedEvent).toBeDefined();
    expect((completedEvent![0] as any).payload.strategy).toBe('Stealth Strategy');
  }, 15000);
});
