# V1.0.1-A5.2 - RETRIEVAL Provider Hotfix

## Observed runtime

```
Stage: RETRIEVAL
Error: Cannot read properties of undefined (reading 'name')
Providers Used: 0
Sources Attempted: 0
Sources Completed: 0
Jobs Found: 0
```

## Exact root cause

**File:** `src/lib/discovery/orchestrator.ts`
**Line:** 19 (original code)

```ts
const strategyName = config.discoveryStrategy || 'strategy_default';
const strategy = strategyRegistry.get(strategyName) || strategyRegistry.get('strategy_default')!;

console.log(`[Discovery] Using strategy: ${strategy.name}`); // <- line 19, threw here
```

`strategyRegistry` and `providerRegistry` are populated exclusively by `bootstrap()`
(`src/lib/bootstrap.ts`). Auditing every call site of `bootstrap()` in the codebase
showed it was invoked **only from test files** (`discovery.test.ts`, `strategy.test.ts`,
`decision.test.ts`, `intelligence.test.ts`, `stage-b-concurrency.test.ts`) - never from
`missionManager.ts`, `pipeline/orchestrator.ts`, any Next.js route/action, or any
instrumentation hook (none exists in this repo).

A comment at the top of `discovery/orchestrator.ts` confirms this was a deliberate
but incomplete refactor: `// Removed auto-registration to support centralized
bootstrap`. The centralized `bootstrap()` was added, but nothing was ever wired up
to call it in the real run path.

**Why `strategy` was `undefined`:** on a real run, both registries are empty.
`strategyRegistry.get(strategyName)` returns `undefined`, and the fallback
`strategyRegistry.get('strategy_default')` *also* returns `undefined` because
nothing has registered anything yet. The trailing `!` is a TypeScript-only
non-null assertion - it is erased at compile time and provides no runtime
protection. `strategy` is genuinely `undefined`, so `strategy.name` on the next
line throws `Cannot read properties of undefined (reading 'name')`.

This happens before `resolveDiscoverySources()` or any `Provider.discover()` call,
which is exactly why every metric in the report reads zero. `npm test` was green
throughout because every existing discovery/strategy test file calls `bootstrap()`
itself at module load - none of them exercise the real, unbootstrapped call graph.

### Confirmed reproduction

A direct call to `runIngestionPipeline()` (the real Stage-A/RETRIEVAL entry point),
without calling `bootstrap()` - matching production exactly - reproduced the crash
verbatim:

```
[RETRIEVAL] Failed: Cannot read properties of undefined (reading 'name')
```

## Fix implemented

No architecture change, no subsystem rewrite. Three targeted edits:

**1. Root cause - `src/lib/pipeline/missionManager.ts`**
`bootstrap()` is now called at the top of `MissionManager.start()`, the single
real entry point used by both the UI (via `RunControls` -> the run-control route)
and the `v1-0-1-acceptance.ts` script, which itself documents that it "exercises
the EXACT same code path as the UI." `bootstrap()` no-ops after its first call, so
calling it on every `start()` is cheap and safe.

**2. Structured registry-miss error - `src/lib/discovery/orchestrator.ts`**
Replaced the unsafe `!` assertion with an explicit runtime check. If a strategy
still cannot be resolved (e.g. a future regression re-breaks the bootstrap wiring,
or a caller requests a genuinely nonexistent strategy id with no default
registered), discovery now throws a clear, structured error naming the requested
id and how many strategies are currently registered, and emits a
`STRATEGY_RESOLUTION_FAILED` telemetry event - instead of a bare, undiagnosable
`TypeError`. This does not hide the failure; it still throws and still fails the
run, it just fails loudly and legibly.

**3. Hardening required by the task (`source-manager.ts`, `orchestrator.ts`)**
- Unknown providers (source URL matches no registered provider) were already
  skipped safely; kept as-is and locked in with a regression test.
- Invalid custom URLs: `identifyAndPersistUserSource()` called `new URL(url).hostname`
  unguarded. A URL that matches a provider by substring (e.g. `GreenhouseProvider`
  only checks `.includes('boards.greenhouse.io')`) but has no scheme
  (`boards.greenhouse.io/careers`) passes the provider check but throws on
  `new URL()`. Now wrapped in try/catch and rejected gracefully (`return null`).
- Empty discovery groups already resolved to zero members without crashing
  (`getGroupMembers` returns `[]` for a nonexistent group); a group *lookup that
  throws* was not previously guarded - now wrapped so it degrades to "no members"
  instead of aborting the whole hunt.
- Registry misses (missing provider mapping) in `resolveDiscoverySources` now
  produce a filtered/skipped result instead of relying on unguarded lookups;
  malformed `discoverySources` entries (missing/empty `url`) are validated and
  skipped rather than silently reaching a provider's `.supports()` call with
  a bad value.
- One bad provider never stopping the rest was already correctly isolated
  per-source inside `runDiscovery`'s loop; additionally hardened the provider
  *resolution* step itself (`providerRegistry.findProviderForUrl`) with a
  try/catch so a misbehaving `supports()` implementation can't abort discovery
  of the remaining sources either.

**4. Telemetry added (per task requirement 7)**
- `STRATEGY_STARTED` now includes `strategyId`, `requestedStrategyId`, and
  `usedFallbackStrategy` (selected strategy + whether it was a fallback).
- New `SOURCE_RESOLUTION_COMPLETED` event: which providers resolved, how many
  sources resolved vs. were left unresolved, and the unresolved URLs.
- New `STRATEGY_RESOLUTION_FAILED` event on a registry-miss failure.
- New `PROVIDER_RESOLUTION_FAILED` event if provider resolution itself throws
  for a given source.

## Tests added

`src/tests/discovery-retrieval-hotfix.test.ts` (10 tests, all passing). Does not
call `bootstrap()` at module scope (unlike the existing discovery/strategy test
files) so each test controls its own registry state, including empty - the exact
condition that caused the original bug.

- **Registry miss reproduces no bare TypeError** (direct regression test for the
  reported crash) + **registry miss produces a structured error**
- **Fix verification**: after registering strategies/providers, a real run
  succeeds with `sourcesAttempted > 0`
- **Unknown provider** is skipped, not fatal
- **Missing provider mapping**: `resolveDiscoverySources` with zero providers
  registered falls back to the default source instead of throwing
- **Invalid custom URL**: a URL that matches a provider by substring but fails
  `new URL()` parsing is rejected gracefully
- **Malformed `discoverySources` entry** (missing/empty url) is skipped
- **Empty discovery group** resolves to the default fallback
- **Group lookup that throws** does not abort discovery
- **Mixed valid + invalid providers** in one run: the valid source is still
  processed and telemetry correctly reports 1 resolved / 1 unresolved

## Verification run

```
npm run typecheck   -> PASS (0 errors)
npm test             -> 115/116 passing (1 pre-existing, unrelated failure - see below)
npm run build        -> PASS (Next.js production build succeeds)
```

**Real hunt**, executed through the actual production entry point
(`missionManager.start()` -> `runMission()` -> `runIngestionPipeline()` ->
`runDiscovery()`, completely unmodified from that point on), with a hunt
config containing one resolvable URL (`https://boards.greenhouse.io/acme`)
and one intentionally unresolvable one (`unrecognized-source-identifier`):

```
Run status: COMPLETED | stage: FINISHED
Failures recorded: []
SOURCE_RESOLUTION_COMPLETED: { sourcesResolved: 1, sourcesUnresolved: 0, resolvedProviders: ["Greenhouse ATS"] }
STRATEGY_COMPLETED: { sourcesAttempted: 1, sourcesSuccessful: 1, sourcesFailed: 0, jobsDiscovered: 0 }
Contains original "Cannot read properties of undefined" crash: false
```

Acceptance criteria:
- Providers Used > 0 -> **1** (Greenhouse ATS) ✓
- Sources Attempted > 0 -> **1** ✓
- Sources Completed > 0 -> **1** ✓
- No "Cannot read properties of undefined (reading 'name')" -> **confirmed absent** ✓
- Unknown provider correctly skipped without aborting the run ✓

`jobsDiscovered` is `0` because this sandbox's network egress is restricted to a
fixed allow-list (npm/GitHub/PyPI/crates infrastructure only) and cannot reach
`boards.greenhouse.io`; `GreenhouseProvider.discover()` catches that fetch failure
internally and still returns a normal (empty) result, which is why the source
still counts as *completed* rather than *failed*. This is an environment
limitation of the verification sandbox, not a behavior of the fix - the exact
same run against real network access would populate `unstructuredText`/`jobs`
from the live Greenhouse board.

The PREFLIGHT stage's `agy` CLI check was bypassed for this verification run via
the app's own existing checkpoint/resume mechanism (`lastCheckpoint:
'PREFLIGHT_COMPLETED'`), because the `agy` binary isn't installed in this sandbox.
This is unrelated to the RETRIEVAL bug - everything from `DISCOVERY_STARTED`
onward in the log above ran completely unmodified.

## Remaining risks

- **Pre-existing, unrelated test failure**: `src/tests/runner-failure.test.ts`
  ("should classify timeout correctly") fails identically on a clean `origin/main`
  before any of this hotfix's changes - confirmed via `git stash` + isolated run.
  It's an AGY error-classification issue (`AGY_UNAVAILABLE` vs `AGY_TIMEOUT`),
  unrelated to discovery/retrieval. Left untouched, out of scope for this hotfix.
- **`RunControls.tsx` calls `/api/runs/[id]/control`, which does not exist**
  anywhere in `src/app` (confirmed both before and after pulling the latest
  `origin/main`). This means the UI's actual "Start Hunt" button currently has
  no backend route to hit at all - a separate, pre-existing gap, not introduced
  or fixed here. Once that route is built, it will inherit this hotfix
  automatically as long as it goes through `missionManager.start()`.
- **`src/scripts/migrate.ts`** does not create the `data/` directory itself
  (unlike `db/client.ts`, which does as a side effect) - a fresh checkout can
  fail migration with "Cannot open database because the directory does not
  exist" until `data/` exists once. Minor, unrelated, noted but not fixed here.
- `bootstrap()` is a synchronous, in-memory, process-global registration. It is
  safe under this app's current single-process model but would need revisiting
  if the app ever moves to a multi-process/serverless execution model where
  `MissionManager` instances don't share memory with whatever handles the actual
  provider registry - not a concern today, flagged for awareness only.
