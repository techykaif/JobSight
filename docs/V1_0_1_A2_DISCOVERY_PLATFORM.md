# JobSight V1.0.1-A2: Discovery Intelligence Platform

## Architecture
JobSight has transitioned from a rigid, monolithic search-driven scraper into a fully modular Discovery Intelligence Platform. The core of this system is the **Provider Registry**. 
The orchestrator now sits atop a decoupled provider ecosystem, adhering strictly to the Open/Closed Principle. Discovery is driven by source capabilities rather than provider-specific hardcoding.

## Registry
The `DiscoveryProviderRegistry` acts as the central clearinghouse for all discovery capabilities. It supports:
- Automatic priority-based sorting.
- O(1) provider lookup.
- Capability-based querying (`findCapableProviders`).
- Dynamic URL-to-provider matching (`findProviderForUrl`).

## SDK & Open Source Extension Guide
JobSight is now extensible by design. To add a new provider (e.g., `MyAwesomeATSProvider`):
1. **Extend `BaseProvider`**: Create a new class implementing the provider interface.
2. **Define Capabilities**: Return a `ProviderCapabilities` object declaring support for pagination, authentication, etc.
3. **Implement `discover()`**: Fetch and parse the data. If the data is unstructured, return it as `unstructuredText` (letting Stage B process it). If structured, return it in the `jobs` array.
4. **Register**: Add it via `providerRegistry.register(new MyAwesomeATSProvider())`.

*No changes to the core orchestrator or ingestion pipeline are required.*

## Discovery Flow
1. **Initialization**: The pipeline triggers `runDiscovery(runId, config)`.
2. **Source Selection**: The orchestrator resolves the desired sources from Groups, Watchlists, and Custom configurations (falling back to Search Engines if necessary).
3. **Provider Execution**: The orchestrator delegates to the highest-priority registered provider that supports each source URL.
4. **Merge**: Results (both structured and unstructured) are combined.
5. **Deduplication**: Results are deduplicated based on canonical job attributes.

## Provider Flow
When `provider.discover()` is called:
- The provider may use direct API integrations if supported (`supportsJobMetadata: true`).
- Or, it may fetch raw HTML/XML text.
- Returning `unstructuredText` seamlessly hands the data to Stage B (Structured Extraction).
- Returning `jobs` bypasses Stage B entirely for those items, heavily reducing latency and token costs.

## Database
The Drizzle schema (`src/lib/db/schema.ts`) has been significantly expanded to persist the discovery graph:
- `providers`
- `sources`
- `groups` & `group_members`
- `watchlists`
- `source_runs`
- `provider_statistics`
Repositories in `src/lib/db/repositories/discovery.ts` handle CRUD operations while preserving backward compatibility.

## Telemetry
Granular telemetry is emitted to the `pipeline_events` table throughout the lifecycle:
- `DISCOVERY_STARTED`: Tracks configuration.
- `SOURCE_STARTED`: Indicates a provider took ownership of a source.
- `SOURCE_COMPLETED`: Records latency and jobs discovered.
- `SOURCE_FAILED` / `SOURCE_SKIPPED`: Tracks errors or unsupported sources.
- `DISCOVERY_COMPLETED`: Final metrics (jobs accepted vs rejected).

## Provider Capabilities
Providers declare capabilities (e.g., `supportsAuthentication`, `supportsSalaryExtraction`). The system dynamically adjusts. For instance, a provider returning `supportsSalaryExtraction: false` informs downstream validators that salary missing is expected.

## Performance
By utilizing structured ATS API extraction and offloading search logic to the Provider subsystem, the orchestrator significantly reduces unstructured LLM overhead. Stage B concurrency limits (MAX=2) remain intact, safely bounding processing.

## Tests
Extensive deterministic tests (`src/tests/discovery.test.ts`) verify:
- Core provider registration.
- Proper URL routing to specific ATS providers.
- Multi-source execution.
- Telemetry emission.

## Remaining Limitations
- Source Group / Watchlist UI integration requires frontend completion (Part 19 UI).
- Real integration of some ATS providers still falls back to fetching raw text instead of utilizing their official open JSON APIs.
- Global discovery budget constraints (max providers, max runtime) are conceptualized but need enforcement logic in the orchestrator loop.
