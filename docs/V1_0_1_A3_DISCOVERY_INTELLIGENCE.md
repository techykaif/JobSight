# JobSight V1.0.1-A3: Discovery Intelligence Engine

## Architecture
JobSight has transitioned from simply finding jobs into an **Opportunity Intelligence Platform**. 
The objective is to deterministically evaluate discovered jobs to rank opportunities based on observable signals—without relying on hallucinated LLM metrics.

This is achieved via a dual-registry architecture:
1. `DiscoveryProviderRegistry` (Discovers jobs, built in V1.0.1-A2)
2. `DiscoveryAnalyzerRegistry` (Analyzes discovered jobs, built in V1.0.1-A3)

The layers remain strictly independent: Providers discover, Analyzers analyze, and the Opportunity Engine calculates final scores.

## Analyzer Registry
The `DiscoveryAnalyzerRegistry` maintains independent intelligence plugins. Currently integrated analyzers include:
- `HiddenGemAnalyzer`
- `VisibilityAnalyzer`
- `AuthenticityAnalyzer`
- `CompetitionAnalyzer`
- `FreshnessAnalyzer`
- `DiscoverySourceAnalyzer`

## Analyzer SDK
To build a new intelligence analyzer:
1. Extend `BaseAnalyzer` and implement `analyze(context)`.
2. Extract observable facts from the `AnalyzerContext` (e.g. `sourceUrl`, `sourceProviderType`).
3. Return an `AnalyzerResult` containing deterministic outputs, a computed confidence score, signals detected, and unknowns encountered.
4. If a vital piece of evidence is missing, return `UNKNOWN` and push the field to the `unknowns` array.
5. Register it in `src/lib/intelligence/analyzers/index.ts`.

## Opportunity Intelligence
The Opportunity Engine (`calculateOpportunityIntelligence`) aggregates outputs from all intelligence layers (currently Discovery Intelligence) into a deterministic `OpportunityScore` (0-100).
It produces a numeric score, a Priority level (`URGENT`, `HIGH`, `NORMAL`, `LOW`, `IGNORE`), and a recommended action.
For example, if Authenticity is `VERY_LOW`, the Priority is immediately downgraded to `IGNORE`.

## Radar
The Opportunity Radar (`generateOpportunityRadar`) provides pre-filtered collections (e.g., Hidden Gems, Recently Posted, Low Competition, Highest Score) to populate targeted UX views, replacing flat lists of uncurated results.

## Historical Trend Foundation
The `detectHiringTrend` utility compares historical snapshots of available jobs (e.g. oldest vs newest) to deterministically output `GROWING`, `STABLE`, `DECLINING`, or `UNKNOWN`.

## Telemetry
The intelligence pipeline emits rich telemetry directly to the DB:
- `ANALYZER_STARTED`
- `ANALYZER_COMPLETED` (includes duration, confidence)
- `ANALYZER_FAILED`
- `DISCOVERY_INTELLIGENCE_COMPLETED` (summarizes overall confidence and missing signals)

## Performance
Because all calculations are done deterministically in TypeScript rather than via the LLM, the entire Intelligence Pipeline executes in milliseconds per job. It adds virtually no overhead to the discovery process.

## Tests
Extensive unit tests (`src/tests/intelligence.test.ts`) assert exactly how specific combinations of signals translate into `HIGH`, `MEDIUM`, `LOW`, or `UNKNOWN` outputs across all analyzers. The Opportunity Engine and Radar logic are fully covered.

## Limitations
- UI integration (Part 15) relies on a future Next.js frontend update to visually display the badges and Radar carousels.
- `FreshnessAnalyzer` currently relies on basic text scanning for phrases like "posted today". A more robust metadata extraction via Stage B may be required in the future for absolute precision.
