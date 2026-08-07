# V1.2.0-B4: Opportunity Discovery Intelligence Engine

## Overview
Phase B4 introduces the Opportunity Discovery Intelligence Engine to JobSight. Building upon the Discovery Engine, Qualification Engine, Company Intelligence (Phase A), Intelligence Foundation (Phase B1), Competition Intelligence (Phase B2), and Company Opportunity Intelligence (Phase B3), this engine answers the question: *"Did JobSight discover something genuinely valuable that most job seekers are unlikely to find?"*

It evaluates the inherent quality, rarity, and confidence of the initial discovery vector. This adds a critical dimension of metadata enabling the Decision Engine to recommend actions like "Apply Now" for rare, high-quality discoveries, or "Monitor" for highly-duplicated, low-visibility jobs.

## Architecture
Located in `src/lib/discovery-intelligence/`, the engine leverages the standard pluggable architecture found across the intelligence pipeline.

- **SDK Interfaces**: `interfaces.ts` and `types.ts` strictly define the `DiscoveryIntelligenceContext` which ingests job records, observations, source telemetry, and prior intelligence outputs (Foundation, Competition, Company Opportunity).
- **Registry**: `registry.ts` manages active `BaseDiscoveryIntelligenceProvider` plugins.
- **Providers**: Implementations in `providers/signals.ts` aggregate and extract metrics (e.g., ATS usage, duplicated data).
- **Calculator**: `calculator.ts` processes these signals into a deterministic 0-100 score and categorical `DiscoveryIntelligenceLevel`.
- **Summary Generator**: `summary.ts` converts the deterministic numerical results into a comprehensive explanation (e.g., Uniqueness: High).
- **Persistence**: `repository.ts` saves all extracted signals, calculated results, and summarized reasons to the database.

## Signal Providers
The following providers have been implemented out of the box:
- `OfficialAtsProvider`: Identifies and assigns significant positive weight (20) to official Application Tracking Systems (Greenhouse, Lever, Ashby, Workday).
- `DirectCareersPageProvider`: Identifies direct company career pages (Weight 15).
- `AggregatorSourceProvider`: Deducts score for jobs discovered via low-friction, high-volume paths like Search Engines and RSS feeds (-10).
- `DuplicateDetectionProvider`: Dynamically verifies how many times the canonical title exists within the discovery run for the company. Duplicates reduce uniqueness and deduct weight (-15), while single instances reward the score (+10).
- `SourceAuthenticityProvider`: Grants strong verifiable trust to official ATS or Career pages.

## Discovery Model & Summarization
Outputs include a score and corresponding Level:
- **Exceptional**, **Excellent**, **Strong**, **Standard**, **Weak**

The summary generator synthesizes categorical strings mapped directly from telemetry:
- `Source Quality`: Premium / Standard / Low
- `Visibility`: High / Medium / Low / Hidden
- `Uniqueness`: High / Medium / Low
- `Authenticity`: Verified / Probable / Unverified / Questionable

## Pipeline Integration
Integrated into `src/lib/pipeline/orchestrator.ts` directly after `COMPANY_OPPORTUNITY_COMPLETED`. The orchestrator extracts the specific `jobSources` mapped to the canonical `jobId`, groups `similarJobsInRun` for uniqueness detection, and injects previously generated Competition and Company Opportunity results into the context.

## Telemetry
Standard event telemetry tracks execution:
- `DISCOVERY_INTELLIGENCE_STARTED`
- `DISCOVERY_INTELLIGENCE_COMPLETED`
- `DISCOVERY_INTELLIGENCE_FAILED`

## Database
Added 3 normalized tables maintaining backward compatibility via Drizzle migration (`0009`). Previous `discovery_intelligence` tables created in Phase A remain untouched to prevent regressions.
1. `opp_discovery_results`: Overall score, level, confidence.
2. `opp_discovery_signals`: Raw observable signals and weights.
3. `opp_discovery_summary`: Finalized categorical explanations.

## Performance
The engine guarantees execution under <50ms per job. It strictly leverages already-persisted database rows and context telemetry rather than conducting live external network requests or re-running AGY DOM traversals.

## Testing
`src/tests/discovery-intelligence.test.ts` successfully validates:
- "Exceptional" derivations based on unique ATS discoveries.
- "Weak" score drops and "Low" uniqueness triggers for heavily duplicated Search Engine aggregator roles.
- Safe graceful fallback capabilities.
- Complete system integration without breaking Phase A UI boundaries.

## Known Limitations
- "Visibility" is currently inferred via the union of `SourceQuality` and `Uniqueness`. As true external platform impressions (e.g., LinkedIn View counts) cannot be deterministically gathered without authentication, visibility remains a deterministic estimate rather than an exact analytics metric.
