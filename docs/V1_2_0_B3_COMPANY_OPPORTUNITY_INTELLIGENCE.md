# V1.2.0-B3: Company Opportunity Intelligence Engine

## Overview
Phase B3 introduces the Company Opportunity Intelligence Engine to JobSight. Building upon the Discovery Engine, Qualification Engine, Company Intelligence (Phase A), Intelligence Foundation (Phase B1), and Competition Intelligence (Phase B2), this engine evaluates whether a company itself represents a worthwhile opportunity for the user.

It produces a deterministic Company Opportunity Profile to answer the question: *"Is this company worth my application time?"* entirely derived from observable evidence rather than LLM reasoning or hallucinations.

## Architecture
Located in `src/lib/company-opportunity/`, the engine leverages the standard pluggable architecture found across JobSight.

- **SDK Interfaces**: `interfaces.ts` and `types.ts` strictly define the unified context (`CompanyOpportunityContext`) that bridges outputs from Phase A, B1, and B2.
- **Registry**: `registry.ts` manages active `BaseCompanyOpportunityProvider` plugins.
- **Providers**: Implementations in `providers/signals.ts` aggregate and extract metrics (e.g., active roles count, posting freshness velocity, engineering focus).
- **Calculator**: `calculator.ts` processes these signals into a final 0-100 score, a categorical `CompanyOpportunityLevel`, and derives the `CompanyOutlookResult` (e.g., Growing, Stable, Slowing).
- **Summary Generator**: `summary.ts` converts the deterministic numerical results into human-readable, explainable string classifications.
- **Persistence**: `repository.ts` saves all extracted signals, calculated results, and summarized reasons to the SQLite database.

## Signal Providers
The following providers have been implemented out of the box:
- `NumberOfActiveRolesProvider`: Determines hiring scale. (>10 roles generates a highly positive opportunity signal).
- `EngineeringHiringProvider`: Looks for specific active roles matching engineering terminology, rewarding companies investing in tech.
- `RemoteHiringProvider`: Cross-references Foundation Engine signals for Remote Policy to elevate companies supporting distributed work.
- `PostingFreshnessProvider`: Identifies hiring velocity based on the volume of jobs posted within the last 7 days.
- `CompetitionScoreProvider`: Cross-references Competition Intelligence to boost companies where the average competition score is low.

## Scoring & Outlook Model
The engine outputs two core deterministic models:
1. **Opportunity Level**: 
   - Weak, Average, Good, Strong, Excellent
   - Derived from aggregated provider weights against a baseline of 40.
2. **Hiring Outlook**: 
   - Growing, Stable, Slowing
   - Derived by calculating "Momentum", heavily influenced by `NumberOfActiveRoles` and `PostingFreshness`.

## Pipeline Integration
Integrated into `src/lib/pipeline/orchestrator.ts` directly after `COMPETITION_COMPLETED`. The orchestrator executes the `COMPANY_OPPORTUNITY_INTELLIGENCE` stage by grouping all processed jobs by their parent `CompanyId`, aggregating their respective Foundation Evidence, Foundation Signals, and Competition Results, and feeding them to the Engine. 

## Telemetry
Standard event telemetry indicates execution stages:
- `COMPANY_OPPORTUNITY_STARTED`
- `COMPANY_OPPORTUNITY_COMPLETED`
- `COMPANY_OPPORTUNITY_FAILED`

## Database
Added 4 normalized tables maintaining backward compatibility via Drizzle migration (`0008`):
1. `company_opportunity`: Overall score, level, confidence.
2. `company_signals`: Raw observable signals and weights.
3. `company_outlook`: Trend, stability, and momentum calculations.
4. `company_summary`: Categorical textual data (e.g., remote friendly, engineering strength).

## Performance
The engine guarantees execution under <50ms per company. It strictly leverages already-persisted database rows rather than conducting live external network requests, preventing duplicate DOM crawling or external API dependency.

## Testing
`src/tests/company-opportunity.test.ts` validates:
- "Growing" hiring outlook derivations based on fresh job velocity.
- "Slowing" hiring outlook handling for stale roles.
- Backwards compatibility execution and graceful provider degradation.
- Extensibility via custom plugin registration.

## Known Limitations
- "Hiring Momentum" is constrained to point-in-time analysis. To achieve full historical momentum, Phase C5 (or subsequent intelligence phases) must implement long-term delta tracking against the `company_opportunity` table.

## Future Extensions
- Expand Provider ecosystem to evaluate Funding/Burn Rate telemetry (when such APIs are available in later phases).
