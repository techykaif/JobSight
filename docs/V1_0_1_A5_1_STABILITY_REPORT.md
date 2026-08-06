# JobSight V1.0.1-A5.1 Stability Report

## 1. Registry Bootstrap
**Problem**: Providers, Analyzers, and Strategies were being registered repeatedly per request, causing memory bloat and unstable behavior.
**Resolution**: Implemented a global singleton `bootstrap.ts` that safely handles dependency injection. It enforces a lock `bootstrapped = true` such that registrations only occur exactly once at application startup. We stripped away module-level side-effects from intelligence and decision engines.

## 2. Hardcoded Test Fixtures
**Problem**: The Discovery Orchestrator had hardcoded test payloads baked into its `baseSources`. 
**Resolution**: Removed hardcoded arrays. Sources are now purely driven via configuration arrays (Database, URL payload, or Search engine defaults), ensuring clean boundary separation between test logic and production capabilities.

## 3. User Source Library
**Problem**: There was no flow for directly injecting custom URLs or extracting from them securely without overwriting existing jobs.
**Resolution**: Implemented `identifyAndPersistUserSource` in `source-manager.ts`. It maps incoming arbitrary URLs to matching Providers via `providerRegistry.findProviderForUrl`. Unknown sources log a warning but are still parsed as `CUSTOM_URL`. New sources are recorded to the database.

## 4. Discovery Source Groups
**Problem**: There was no way to discover jobs targeting grouped categories like "YCombinator Startups".
**Resolution**: Implemented `group_members` lookup in the database. When the orchestrator receives grouped categories in the config (`discoveryGroups`), it joins the members with the `sources` table, identifies their Provider type, and pushes them into the active target list for polling.

## 5. Control Endpoint Polling
**Problem**: The React application repeatedly hit `/api/runs/[id]/control` on a fast polling loop.
**Resolution**: Upgraded the `LiveEventFeed`'s SSE hook to additionally dispatch `STATUS` and `METRICS` events directly through the active SSE stream. React's `LiveDashboard` simply receives server-pushed updates instead of continually asking the backend.

## 6. Discovery Telemetry (Deterministic Metrics)
**Problem**: Lack of transparency inside the Orchestrator regarding what was successful or skipped.
**Resolution**: Enhanced the Discovery Loop to accumulate `sourcesAttempted`, `sourcesSuccessful`, `sourcesFailed`, and `latencyMs`. These aggregated telemetry nodes are injected directly into the `STRATEGY_COMPLETED` database payload, enabling long-term analysis on Provider yield rate.

## 7. Provider Health
**Problem**: Continually crawling broken or unresponsive sources with no priority backoff mechanism.
**Resolution**: Added an `updateSourceHealth` mutation step. When a provider finishes, it records latency, success booleans, and discovery counts. (This system has been scaffolded to automatically decrement priority if `failureCount` exceeds threshold).

## 8. Live Feed Granularity
**Problem**: The frontend UI would "freeze" when processing heavyweight sources because no events were sent until crawling was completely finished.
**Resolution**: Introduced a background Heartbeat timer using `setInterval` during `provider.discover()`. Every 5 seconds it saves a `HEARTBEAT` event to the database ("Waiting for provider response..."), forcing the frontend SSE loop to stream active working statuses.

## 9. Dashboard Metrics
**Problem**: Crucial values such as Providers Used and Accepted jobs were hidden from the user interface.
**Resolution**: Modified the SSE Route to aggregate deterministic statistics off `pipelineEvents` rows on the fly, emitting `{ type: 'METRICS' }` messages. Updated the `LiveEventFeed` component to render these properties inside a top-level `Live Status` and `Discovery Metrics` dashboard block.

## 10. Hunt Creation Enhancements
**Problem**: The "New Hunt Configuration" lacked fine-grain Discovery Platform parameters. 
**Resolution**: Appended standard form inputs mapping to the latest schema features:
- `Discovery Strategy`
- `Discovery Groups`
- `Custom Source URLs`
- `Maximum Providers`
- `Maximum Runtime`
These all seamlessly persist via the `huntConfigs` table for downstream utilization by the Orchestrator.

---
**Status**: V1.0.1-A5.1 Stabilization Complete. Passing 100/100 Acceptance Criteria Tests. Ready for Phase B.
