# JobSight V1.0.1-A5: Stealth Discovery Mode

## Architecture
JobSight has introduced the fourth and final plugin system of V1.0.1 Phase A: **The Discovery Strategy Engine**.
Rather than modifying *what* jobs are scored or *how* they are evaluated, the Strategy Engine dynamically manipulates *how* the orchestrator discovers jobs. It sits directly inside the `runDiscovery` loop and dictates provider weighting, ordering, budgeting, and early termination.

## Strategy Registry
The `DiscoveryStrategyRegistry` is independent of all previous registries. It registers single-purpose plugins that dictate hunting behavior.
Built-in strategies include:
- `DefaultStrategy`
- `StealthStrategy` (Heavy ATS/Career Page bias, deprioritized aggregators)
- `HighCompensationStrategy`
- `RemoteFirstStrategy`
- `StartupStrategy` (Ashby/Lever bias)
- `EnterpriseStrategy` (Workday bias)
- `FastHiringStrategy`

## Strategy SDK
Extending the Discovery Strategy requires implementing the `DiscoveryStrategy` interface:
1. Extend `BaseStrategy`.
2. Override `prioritizeSources(sources)` to assign dynamic `weight` properties based on source types or urls. The Orchestrator automatically sorts descending by weight.
3. Override `getConfiguration()` to adjust `maxUsableOpportunities`, `maxBudgetMs`, and `maxProviderRuntimeMs`.
4. Override `shouldTerminateEarly(metrics, config)` if customized budget exhaustion rules are needed.

## Discovery Flow
1. The orchestrator receives the config containing `discoveryStrategy`.
2. It fetches the Strategy from the registry (falling back to `DefaultStrategy`).
3. The strategy prioritizes and weights the sources.
4. The loop iterates through sources. Before each source, it calls `shouldTerminateEarly()`.
5. Once complete or terminated, it deduplicates and emits completion metrics.

## Weighting
Weights are numeric (0-100). Higher weights are processed first. `StealthStrategy` manually overrides Career Pages to `100` and drops Search Engines to `40`.

## Budget & Termination
Strategies strictly enforce budgets. By default:
- Maximum usable jobs: 5
- Maximum discovery runtime: 60,000ms
`StealthStrategy` extends the runtime budget to 120,000ms to allow deeper digging but caps usable jobs at 3 to remain heavily targeted.

## Telemetry
The pipeline emits detailed events directly into the database:
- `STRATEGY_STARTED` (Contains budget and selected strategy)
- `EARLY_TERMINATION` (Emitted if budget or job targets are hit before sources run out)
- `STRATEGY_COMPLETED` (Contains total runtime and discovery conversions)

## Tests
Extensive tests (`src/tests/strategy.test.ts`) assert that weights apply correctly per strategy and that the Orchestrator respects early termination logic dynamically.

## Future Strategies
Because of the decoupled design, adding a `BoutiqueAgencyStrategy` or `AIHiringStrategy` requires exactly zero changes to the underlying providers, orchestrator, or downstream intelligence engines. It purely adjusts the hunting parameters.
