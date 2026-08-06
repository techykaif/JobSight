/**
 * V1_0_1_A5_2 - RETRIEVAL Provider Hotfix regression tests.
 *
 * Original bug: runDiscovery() crashed with
 *   "Cannot read properties of undefined (reading 'name')"
 * before any Provider.discover() ran, because bootstrap() (which registers
 * discovery providers and strategies) was only ever called from test files,
 * never from any real production entry point. See:
 *   docs/V1_0_1_A5_2_PROVIDER_HOTFIX.md
 *
 * This file deliberately does NOT call bootstrap() at module scope (unlike
 * discovery.test.ts / strategy.test.ts) so each test can control the exact
 * registry state it needs, including the empty-registry state that caused
 * the original crash. Vitest isolates modules per test file by default
 * (see vitest.config.ts - no isolate/pool override), so this file's use of
 * providerRegistry.clear() / strategyRegistry.clear() does not affect the
 * singletons used by other test files.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { providerRegistry } from '../lib/discovery/registry.js';
import { strategyRegistry } from '../lib/discovery/strategy/registry.js';
import { runDiscovery } from '../lib/discovery/orchestrator.js';
import { resolveDiscoverySources, identifyAndPersistUserSource } from '../lib/discovery/source-manager.js';
import { registerCoreProviders, GreenhouseProvider } from '../lib/discovery/providers/index.js';
import { registerCoreStrategies } from '../lib/discovery/strategy/index.js';
import * as repos from '../lib/db/repositories/index.js';

vi.mock('../lib/db/repositories/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    saveEvent: vi.fn(),
    getGroupMembers: vi.fn(),
    getSource: vi.fn(),
  };
});

vi.mock('../lib/agy/runner.js', () => ({
  runAgyUnstructured: vi.fn().mockResolvedValue('Mocked search engine results'),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  text: async () => 'Mocked provider HTML content',
}) as any;

beforeEach(() => {
  providerRegistry.clear();
  strategyRegistry.clear();
  vi.mocked(repos.saveEvent).mockClear();
  vi.mocked(repos.getGroupMembers).mockReset();
  vi.mocked(repos.getSource).mockReset();
});

describe('V1_0_1_A5_2: RETRIEVAL registry-miss hotfix', () => {
  it('REGRESSION: does not throw the original bare TypeError when the registry is empty', async () => {
    // Reproduces the exact production conditions of the original bug:
    // bootstrap() never called, so both registries are empty.
    const config = { targetRoles: ['Software Engineer'] };

    let caught: any;
    try {
      await runDiscovery('run_regression', config);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught.message).not.toMatch(/Cannot read propert/i);
  });

  it('registry miss produces a structured error identifying the missing strategy', async () => {
    const config = { targetRoles: ['Software Engineer'], discoveryStrategy: 'strategy_does_not_exist' };

    await expect(runDiscovery('run_registry_miss', config)).rejects.toThrow(/Strategy resolution failed/);

    const failedEvent = vi.mocked(repos.saveEvent).mock.calls
      .map(c => c[0])
      .find((e: any) => e.eventType === 'STRATEGY_RESOLUTION_FAILED');
    expect(failedEvent).toBeDefined();
    expect((failedEvent as any).payload.requestedStrategy).toBe('strategy_does_not_exist');
  });

  it('FIX VERIFICATION: after bootstrap-equivalent registration, a real run succeeds with providers > 0', async () => {
    registerCoreStrategies();
    registerCoreProviders();

    const config = {
      targetRoles: ['Software Engineer'],
      discoverySources: [{ url: 'https://boards.greenhouse.io/acme', type: 'GREENHOUSE' }],
    };

    const result = await runDiscovery('run_fixed', config);
    expect(result).toBeDefined();

    const completed = vi.mocked(repos.saveEvent).mock.calls
      .map(c => c[0])
      .find((e: any) => e.eventType === 'STRATEGY_COMPLETED');
    expect(completed).toBeDefined();
    expect((completed as any).payload.sourcesAttempted).toBeGreaterThan(0);
  });
});

describe('V1_0_1_A5_2: unknown / missing provider mapping', () => {
  it('unknown provider: a source matching no registered provider is skipped, not fatal', async () => {
    registerCoreStrategies();
    // Deliberately register zero providers - every source is "unknown".

    const config = {
      targetRoles: ['Software Engineer'],
      // Not an http(s) URL, so even the generic CareersPageProvider
      // catch-all (which matches any http/https URL) can't claim it.
      discoverySources: [{ url: 'unrecognized-source-identifier', type: 'UNKNOWN_TYPE' }],
    };

    const result = await runDiscovery('run_unknown_provider', config);
    expect(result.jobs).toEqual([]);

    const completed = vi.mocked(repos.saveEvent).mock.calls
      .map(c => c[0])
      .find((e: any) => e.eventType === 'STRATEGY_COMPLETED');
    expect((completed as any).payload.sourcesAttempted).toBe(0);
  });

  it('missing provider mapping: resolveDiscoverySources falls back to the default source instead of throwing', async () => {
    // No providers registered at all.
    const sources = await resolveDiscoverySources({ userUrls: ['https://boards.greenhouse.io/acme'] });
    expect(sources).toEqual([{ url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' }]);
  });
});

describe('V1_0_1_A5_2: invalid custom URLs never abort the hunt', () => {
  it('a URL that matches a provider by substring but fails URL parsing is rejected gracefully, not thrown', async () => {
    providerRegistry.register(new GreenhouseProvider());
    vi.mocked(repos.getGroupMembers).mockResolvedValue([]);

    // No scheme - matches GreenhouseProvider.supports() via substring match,
    // but `new URL(...)` on this throws. Previously uncaught.
    const result = await identifyAndPersistUserSource('boards.greenhouse.io/careers');
    expect(result).toBeNull();
  });

  it('a discoverySources entry with a missing/empty url is skipped, not thrown', async () => {
    const sources = await resolveDiscoverySources({
      discoverySources: [
        { type: 'CUSTOM' }, // no url at all
        { url: '', type: 'CUSTOM' }, // empty url
        { url: 'https://boards.greenhouse.io/acme', type: 'GREENHOUSE' }, // valid
      ],
    });
    expect(sources).toEqual([{ url: 'https://boards.greenhouse.io/acme', type: 'GREENHOUSE' }]);
  });
});

describe('V1_0_1_A5_2: empty / missing discovery groups', () => {
  it('a group with zero members resolves to the default search-engine fallback', async () => {
    vi.mocked(repos.getGroupMembers).mockResolvedValue([]);

    const sources = await resolveDiscoverySources({ discoveryGroups: ['group_empty'] });
    expect(sources).toEqual([{ url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' }]);
  });

  it('a group lookup that throws (e.g. deleted group) does not abort discovery', async () => {
    vi.mocked(repos.getGroupMembers).mockRejectedValue(new Error('no such table row'));

    const sources = await resolveDiscoverySources({ discoveryGroups: ['group_deleted'] });
    expect(sources).toEqual([{ url: 'SEARCH_ENGINE', type: 'SEARCH_ENGINE' }]);
  });
});

describe('V1_0_1_A5_2: mixed valid + invalid providers', () => {
  it('valid sources still get processed when other sources in the same run are invalid/unknown', async () => {
    registerCoreStrategies();
    registerCoreProviders();

    const config = {
      targetRoles: ['Software Engineer'],
      discoverySources: [
        { url: 'https://boards.greenhouse.io/acme', type: 'GREENHOUSE' }, // valid
        // Not http(s), so it can't fall through to the generic CareersPageProvider catch-all.
        { url: 'unrecognized-source-identifier', type: 'UNKNOWN_TYPE' }, // unresolvable
        { url: '', type: 'CUSTOM' }, // malformed
      ],
    };

    const result = await runDiscovery('run_mixed', config);
    expect(result).toBeDefined();

    const eventTypes = vi.mocked(repos.saveEvent).mock.calls.map(c => (c[0] as any).eventType);
    expect(eventTypes).toContain('PROVIDER_STARTED');

    const resolution = vi.mocked(repos.saveEvent).mock.calls
      .map(c => c[0])
      .find((e: any) => e.eventType === 'SOURCE_RESOLUTION_COMPLETED');
    expect((resolution as any).payload.sourcesResolved).toBe(1);
    expect((resolution as any).payload.sourcesUnresolved).toBe(1);
  });
});
