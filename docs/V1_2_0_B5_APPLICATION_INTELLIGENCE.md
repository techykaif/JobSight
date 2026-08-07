# V1.2.0-B5: Application Intelligence Engine

## Overview
Phase B5 introduces the **Application Intelligence Engine**, acting as the ultimate intelligence aggregation layer before the Decision Engine. It combines all preceding signals (Discovery, Qualification, Company Intelligence, Competition, Company Opportunity, and Opportunity Discovery) into a single deterministic evaluation answering: *"Should the user apply right now?"*

The engine completely avoids hallucination or LLM-generated prose, instead opting for observable evidence-driven scoring. It guarantees <50ms execution per application evaluated.

## Architecture
Located in `src/lib/application-intelligence/`, the architecture follows the existing plugin-based SDK pattern:

- **SDK Interfaces**: `interfaces.ts` and `types.ts` declare the `ApplicationIntelligenceContext` which ingests Candidate Profiles, Qualification Engine outputs, Competition metrics, Company Opportunity outputs, and Discovery Intelligence evaluations.
- **Registry**: `registry.ts` manages active `BaseApplicationIntelligenceProvider` plugins.
- **Providers**: `providers/signals.ts` calculate deterministic weightings.
- **Calculator**: `calculator.ts` aggregates these weights into a `score` and categorical `readinessLevel`.
- **Summary Generator**: `summary.ts` safely infers strengths, weaknesses, missing skills, and risk factors from signal variations.
- **Persistence**: `repository.ts` saves all extracted signals and calculations to the database via normalized SQLite tables.

## Signal Providers
- `QualificationMatchProvider`: Synthesizes initial qualification confidence.
- `MissingSkillsProvider`: Conducts a differential analysis between required skills (from qualification outputs) and actual Candidate Profile skills. 
- `CompetitionScoreProvider`: Deducts readiness if competition is too high or rewards low competition environments.
- `CompanyOpportunityProvider`: Synthesizes company reputation/opportunity signals.
- `DiscoveryIntelligenceProvider`: Rewards readiness based on discovery channel rarity and source authenticity.

## Application Model
The resulting output produces:
1. **Application Readiness Level**: `Ready Now`, `Almost Ready`, `Needs Improvement`, `Not Recommended`.
2. **Confidence**: Scaled by the depth of data provided (more signals = more confidence).
3. **Strengths/Weaknesses/Missing Skills/Risk Factors**: Derived entirely from deterministic threshold crossing.
4. **Recommendation**: Prescriptive structured guidance (`Apply Immediately`, `Customize Resume First`, `Upskill Before Applying`, `Skip Application`).

## Pipeline Integration
Integrated into `src/lib/pipeline/orchestrator.ts` directly after `DISCOVERY_INTELLIGENCE_COMPLETED`. The orchestrator injects `CandidateProfile`, scores, `CompetitionResult`, `CompanyOpportunityResult`, and `DiscoveryIntelligenceOutput` into the engine context.

## Telemetry
Standard event telemetry tracks execution:
- `APPLICATION_INTELLIGENCE_STARTED`
- `APPLICATION_INTELLIGENCE_COMPLETED`
- `APPLICATION_INTELLIGENCE_FAILED`

## Database
4 fully normalized SQLite tables have been appended in migration `0010_phase_b5_application_intelligence.sql`:
1. `application_results`: Final score, readiness level, confidence.
2. `application_signals`: Raw observable signals and generated weight logic.
3. `application_summary`: Strengths, weaknesses, risks, and missing skills.
4. `application_recommendations`: Deterministic recommended actions.

## Performance
The engine completes fully in-memory via SQLite fetches and standard JS evaluation, operating well under the <50ms strict threshold per job. 
No external network requests, AGY traversals, or LLM tokens are consumed.

## Testing
`src/tests/application-intelligence.test.ts` validates deterministic mappings:
- "Ready Now" (Score 100) and "Apply Immediately" for perfect candidates with missing 0 skills and high provider confidence.
- "Not Recommended" (Score 0) and "Skip Application" for candidates missing multiple core skills facing high competition.
- "Almost Ready" (Score 60) and "Customize Resume First" for candidates with minor missing skills and average competition.

## UI Preparation
The models generate cleanly structured strings and sets, ready to be ingested by frontend visual components (React) in future milestones.

## Known Limitations
- The accuracy of Application Intelligence is linearly bound to the accuracy of previous engines (e.g. Qualification). If the Qualification Engine extracts improper skills, the Application Intelligence Engine will penalize the candidate improperly. 
- "Resume Completeness" provider remains a stub waiting for active parsed resume ingestion in later phases.
