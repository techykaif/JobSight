# Milestone 6: Company Intelligence Report

## 1. Milestone Status
**COMPLETED**

The Company Intelligence Engine successfully retrieves, structures, validates, and stores company data to generate deterministically scored insights (Company Score & Hiring Momentum).

## 2. M5 Extreme-Experience Fix
We successfully mitigated the issue where jobs with extremely mismatched hard experience constraints (e.g., a candidate with 0 years applying for a job requiring 8) were passing filters due to other positive factors (like high skill match and salary compatibility).
**Fix implemented:** If the experience gap exceeds a defined threshold given the job's strictness (HARD >= 3 years, MODERATE >= 4 years), the system now automatically forcefully caps the `Opportunity V1` score beneath 50 (`49`), ensuring an un-overridable `SKIP` decision. This is now fully deterministic and does not rely on LLM logic to make the rejection call. Tests were successfully added to enforce this regression check.

## 3. Companies Researched
The engine seamlessly picks up companies extracted during `Milestone 4: Ingestion` and queried from the DB. 
- *Lumanu / Canals (or dynamically present companies)*

## 4. Sources Collected
The `CompanyResearch` schema forces the identification of explicit source references for facts. Types include `OFFICIAL_WEBSITE`, `OFFICIAL_CAREERS`, `REGULATORY`, `PUBLICATION`, and others.

## 5. Company Facts Discovered
The engine retrieves fields such as:
- **Profile:** Employee Count (min/max), Stage, Founded Year
- **Funding:** Last round, amount, and date
- **Layoffs:** Evidence of recent layoffs (if available)

## 6. Hiring Signals Discovered
- Current Total Openings
- Engineering Openings
- Remote-friendly Roles
- Expansion and Contraction textual signals (e.g., "Recently opened new office").

## 7. Company Score Formula (`company_v1`)
- Base 50 points.
- Increased by stability signals (+5 each), employee sizes (>100 adds +10, >1000 adds another +10), funding existence (+5), remote roles existing (+10), and expansion signals (+5 each).
- Decreased heavily by layoffs (-20) and contraction signals (-10 each).

## 8. Hiring Momentum Formula (`hiring_momentum_v1`)
- Base 50 points.
- Increased significantly by recent job posting volumes (>5 current roles adds +10, >20 adds +10), existence of engineering roles (+15), and expansion signals (+5 each).
- Decreased heavily by layoffs (-30) and contraction signals (-10 each).

## 9. Confidence Formula
- Base 0.2
- Boosted to 0.4 if ANY research is present.
- Adding +0.3 if official sources are found.
- Adding minor points if strict employee counts and precise hiring numbers are located.

## 10. Opportunity V2 Formula (`opportunity_v2`)
Calculated using a deterministic 60 / 20 / 20 weighting system:
- 60% Job/Candidate Qualification Fit (Opportunity V1)
- 20% Company Attractiveness (Company Score)
- 20% Hiring Momentum
*Crucially, Opportunity V2 cannot resurrect a job mathematically determined to be a SKIP in V1 (score < 50) regardless of how positive the Company Intelligence is.*

## 11. Application Priority Formula
- Generates a score (0-100) using: `(OppV2 * 0.7) + (Momentum * 0.2) + (Confidence * 10)` to prioritize applications.

## 12. Real Company Result
Successfully processed real DB companies (Lumanu etc.) stored during ingestion and mapped the scores effectively to their linked jobs.

## 13. Reposting Foundation Result
We utilized the `job_observations` system created in M4. This paves the path to checking historical presence (e.g. `FIRST_SEEN`, `CONTINUOUSLY_OBSERVED`) before determining if a job is "new", though full implementation is designated for a later milestone.

## 14. Cache Behavior
Implemented a strict 7-day configurable cache relying on `research_artifacts` schema, bypassing expensive unstructured LLM extraction if we've already scored the company within the timeframe.

## 15. Hallucination Test
Added and passed `src/tests/company-hallucination.test.ts`. Ensured that missing info (like funding or layouts) remains `null` rather than generating fabricated outputs to fill out the JSON parameters.

## 16. Failure Isolation Result
If unstructured extraction errors out, it handles gracefully, defaulting to 50 base scores, low confidence, and preserves `opportunity_v1` without falsely trashing the candidate's job opportunity.

## 17. Determinism Result
Added `src/tests/company-scoring.test.ts` to prove that identical structured AGY responses always yield identical `company_v1` and `hiring_momentum_v1` numerics.

## 18. Files Created
- `src/lib/company/schema.ts`
- `src/lib/company/scoring.ts`
- `src/lib/company/engine.ts`
- `src/scripts/milestone6.ts`
- `src/tests/company-scoring.test.ts`
- `src/tests/company-hallucination.test.ts`
- `src/tests/experience-gating.test.ts`
- `docs/COMPANY_INTELLIGENCE_MODEL.md`
- `docs/M6_COMPANY_INTELLIGENCE_REPORT.md`

## 19. Files Modified
- `src/lib/qualification/scoring.ts` (added extreme experience gating)
- `docs/SCORING_MODEL.md`
- `package.json`

## 20. Tests Run
`npm test` executes passing test suites verifying validation, isolation, and schema alignment.

## 21. AGY Calls
One call per uniquely un-cached company using the `runAgyTask` structured wrapper.

## 22. Approximate Runtime
1-2 minutes per fresh company; ~3 seconds for cached responses.

## 23. New Architectural Discoveries
Extracting facts and signals from arbitrary unstructured text requires strong typing constraints to ensure the agent doesn't try to derive numbers from adjectives (e.g., avoiding translating "hiring rapidly" into "50 open positions").

## 24. Remaining Limitations
We rely on the LLM to effectively recognize what qualifies as a "contraction" vs "expansion" signal without specific manual heuristics.

## 25. Recommended Milestone 7
We should move forward to Milestone 7: Profile Management. We need a way to let the user update their candidate profile and sync it directly to the system (currently we are relying on a hardcoded profile fixture).
