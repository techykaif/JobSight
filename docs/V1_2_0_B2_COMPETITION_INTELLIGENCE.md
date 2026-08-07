# V1.2.0-B2: Competition Intelligence Engine

## Overview
Phase B2 introduces the Competition Intelligence Engine to the JobSight Opportunity Intelligence Platform. Building directly upon the Intelligence Foundation Engine (Phase B1), it deterministically estimates the relative competitiveness of an opportunity entirely from observable signals without relying on LLM hallucinations or guessing applicant counts.

## Architecture
Located in `src/lib/competition/`, the engine leverages a pluggable architecture identical to the broader platform.

- **SDK Interfaces**: `interfaces.ts` and `types.ts` strictly define inputs (e.g. `CompetitionContext`) and outputs (`CompetitionSignal`, `CompetitionResult`, `CompetitionSummary`).
- **Registry**: `registry.ts` manages active `BaseCompetitionProvider` plugins.
- **Providers**: Implementations in `providers/signals.ts` extract signals from the observable evidence generated during Phase B1.
- **Calculator**: `calculator.ts` normalizes signal weights into a 0-100 score and categorizes them into a `CompetitionLevel` (Very Low, Low, Medium, High, Very High).
- **Summary Generator**: `summary.ts` builds deterministic, explainable reasons (e.g. "✓ Official ATS (High Visibility)").
- **Persistence**: `repository.ts` saves all extracted signals, calculated results, and summarized reasons to the SQLite database.

## Signal Providers
The following providers have been implemented out of the box:
- `OfficialATSProvider`: Identifies jobs indexed by major ATS platforms (Greenhouse, Lever, etc.) which typically result in higher competition.
- `DirectCareersPageProvider`: Flags jobs that require application via a bespoke careers page, typically resulting in a minor reduction in competition compared to easy-apply paths.
- `RemoteAvailabilityProvider`: Determines if a role is remote (or worldwide remote), assigning a high positive weight to competition.
- `PostingFreshnessProvider`: Flags very fresh jobs (<= 3 days old) as highly competitive due to initial applicant surges, and heavily discounts older jobs (> 30 days).
- `ProviderPopularityProvider`: Increases competition score heavily if the job was discovered via massive aggregators (e.g., LinkedIn, Indeed).

*Providers fail gracefully and output nothing if data is unavailable, allowing the engine to calculate a base competition score.*

## Scoring Model
1. **Base Score**: All jobs start with a baseline score of 40 (Low-Medium).
2. **Signal Aggregation**: Configurable integer weights from matching providers are summed. 
3. **Boundaries**: The final score is constrained between 0 and 100.
4. **Classification**:
   - 0-20: Very Low
   - 21-40: Low
   - 41-60: Medium
   - 61-80: High
   - 81-100: Very High

## Pipeline Integration
Integrated into `src/lib/pipeline/orchestrator.ts` directly after `FOUNDATION_COMPLETED` and before `RANKING`. The orchestrator fetches `evidence_items` and `observable_signals` emitted by the Intelligence Foundation Engine and passes them into the `CompetitionContext` to avoid duplicate AGY executions or page fetches.

## Telemetry
The pipeline emits standard event telemetry indicating execution stages:
- `COMPETITION_STARTED`
- `COMPETITION_COMPLETED`
- `COMPETITION_FAILED`

## Database
Added 3 normalized tables maintaining backward compatibility with Phase A/C:
1. `competition_results`: The final 0-100 score and level.
2. `competition_signals`: The raw observable signals with applied weights.
3. `competition_summary`: The final string[] array of reasons explaining the score.

## Performance
The engine guarantees execution under <50ms per opportunity because it strictly consumes already-persisted database rows (from Phase B1 Foundation) rather than conducting live external network requests.

## Testing
`src/tests/competition-intelligence.test.ts` provides extensive deterministic validation of:
- Provider Registry behavior.
- High competition scenarios (fresh, remote, major board).
- Low competition scenarios (old, obscure, direct apply).
- Fallback/missing data handling.
- Extensibility via custom plugin registration.

## Known Limitations
- The Engine currently cannot discern between "Ghost Jobs" and genuinely low competition old jobs.
- The Engine has limited visibility into actual company sizes unless injected externally into the company intelligence module prior to B2.

## Future Extensions
- Introduce `AggregatorPresenceProvider` to penalize jobs scraped automatically across dozens of distinct domains.
- Fine-tune weighting configurations by deriving correlation factors against real-world conversion rates in Phase C5.
