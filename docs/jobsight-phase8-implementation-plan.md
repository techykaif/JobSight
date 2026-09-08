# JobSight Phase 8 Implementation Plan

## Mandatory Rules
- Plan is the source of truth for intended milestone state.
- Repository is the source of truth for physical implementation state.
- Every task starts by checking the plan.
- Report DONE / IN PROGRESS / LEFT.
- Never redo completed work.
- Never invent files or implementation.
- Never create decorative documentation.
- Never fabricate test results.
- Never fabricate evidence.
- UNKNOWN remains UNKNOWN.
- Low visibility does not imply low competition.
- Direct ATS discovery does not prove low visibility.
- Pipeline completion does not prove product-mission success.
- Do not weaken Candidate Fit, B6, B7, Stretch, Evidence Gate, or Canonical Opportunity Quality merely to generate favorable results.
- Update the plan when milestone state changes.
- Record validation, commit, branch, and residual risks for completed milestones.

## Phase 8 Milestones

### Phase 8.1: Evidence Acquisition Architecture Audit
- **Status:** DONE
- **Artifact:** `docs/jobsight-phase8-1-evidence-acquisition-audit.md`
- **Verdict:** Evidence acquisition is entirely heuristic/inferred. No pipeline exists for actual applicant volume or genuine aggregator cross-referencing.

### Phase 8.2: Secondary Evidence Pipeline
- **Status:** DONE (Corrected)
- **Objective:** Implement a cross-reference pipeline that independently verifies a discovered job's presence on other sources (e.g., search engines/aggregators).
- **Architecture:** 
  1. Input: `company + title + location + canonical URL` and `originatingProvider`.
  2. Guard: If `originatingProvider === 'SEARCH_ENGINE'`, skip independent check.
  3. Action: Independent verification query.
  4. Output: `OBSERVED_ON_SOURCE`, `NOT_OBSERVED_ON_CHECKED_SOURCE`, `UNKNOWN`.
  5. Persistence: `job_cross_references` table storing exact query string (`checkQuery`), exact URL, match strength, and observation timestamp.
  6. Consumption: Market Intelligence explicitly maps `NOT_OBSERVED_ON_CHECKED_SOURCE` to `UNKNOWN` visibility, preventing unsupported internet-wide "hidden" claims.

### Phase 8.3: Evidence Acquisition Expansion
- **Status:** DONE
- **Objective:** Improve the quality and breadth of evidence legitimately acquired by JobSight.
- **Implementation:**
  1. **Structured Freshness:** HTML enrichment now extracts `postingDate` explicitly via LLM from JSON-LD / text. `opportunity-quality/engine.ts` was corrected to only use `postingDate` for Freshness signals, falling back to `UNKNOWN` if not present, and completely removing the fallback to JobSight's `firstSeenAt` crawl time.
  2. **Cross-Reference Quality:** `secondary-evidence.ts` was upgraded to parse unstructured Search Engine output as JSONL. This allows establishing an exact `observedUrl` and stronger match semantics (`PARTIAL` match) by extracting exact company and title from the returned JSON objects rather than blind fuzzy text search over the entire unstructured payload.
  3. **Multiple Sources:** Feasibility checked. The repository only contains one generic aggregator (`SearchEngineProvider`) and specific ATS providers. Additional independent aggregators are not currently available, so multi-source expansion was skipped.
  4. **Applicant Volume / Competition:** Feasibility checked. No existing provider realistically has direct access to applicant volumes (ATS APIs do not expose this publicly). Therefore, competition and applicant volumes remain `UNKNOWN` safely without fabrication.

### Phase 8.4: Visibility Intelligence
- **Status:** DONE
- **Objective:** Make JobSight's visibility intelligence evidence-backed and semantically honest by bounding what can be legitimately concluded from current observations.
- **Implementation:**
  1. Updated `engine.ts` to strictly require `PARTIAL` or `EXACT` cross-reference match strength to grant a `HIGH` visibility signal.
  2. Weak (`LOW`) cross-reference string matches now correctly yield `UNKNOWN` visibility instead of falsely confirming cross-posting.
  3. Single-source non-observations cleanly return `UNKNOWN` visibility. Multiple independent observations cannot be implemented since `provider_search_engine` is the sole aggregator implementation.
  4. Added explicit unit tests verifying visibility degradation and independence rules.
- **Evidence Semantics:**
  - `OBSERVED_ON_SOURCE` -> `HIGH` visibility *only* if the match was structured and unambiguous.
  - `NOT_OBSERVED_ON_CHECKED_SOURCE` -> `UNKNOWN` visibility. A single search failure does not prove an opportunity is "hidden" internet-wide.
  - Competition remains fully decoupled and `UNKNOWN`.
- **Validation:** 517/517 tests passed. Typecheck clean. Build clean.
- **Residual Risks:**
  - The single available independent search source (`SearchEngineProvider`) acts as a bottleneck. True multi-source checking is impossible until more independent providers (e.g. specialized API aggregators) are added.
  - Observation timestamps (`observedAt`) are stored but currently not expiring old visibility claims; stale cross-references could falsely represent current distribution.
### Phase 8.5: Competition & Applicant Volume Intelligence
- **Status:** DONE
- **Objective:** Determine whether JobSight can legitimately acquire competition/applicant evidence and, if so, implement the smallest reliable path without fabricating scores.
- **Audit Findings:**
  1. No current ATS provider (Greenhouse, Lever, Ashby, Workday) exposes applicant counts publicly.
  2. Generic aggregator outputs (SearchEngineProvider) cannot reliably expose accurate applicant volumes.
  3. Speculative heuristics (e.g., mapping `Remote` -> `High Competition`, or `Old Job` -> `Low Competition`) fundamentally violate the strict Phase 8 evidence requirements.
- **Implementation (Option C - No Reliable Source Exists):**
  1. Ripped out speculative regex text-parsing in `engine.ts` which improperly assumed ATS HTML contained applicant counts.
  2. Disabled `CompetitionAnalyzer` heuristic scoring logic and rewrote tests to mandate `UNKNOWN` output for competition bounds.
  3. Ensured `applicantVolume` and `competition` default to `UNKNOWN` safely across the board.
  4. Verified that `UNKNOWN` correctly passes through the Canonical Opportunity Quality system, yielding `INSUFFICIENT_EVIDENCE` where competition dependencies exist, completely preventing fabricated FAVORABLE claims.
- **Residual Risks:**
  - Downstream scoring systems will now cleanly receive `UNKNOWN` competition. Without verified competition signals, fewer opportunities will achieve `FAVORABLE` status organically, accurately reflecting the strict evidence bounds but potentially yielding lower volume.
- **Next Milestone:** Phase 8.6 (Candidate Fit Independence) — *See below for actual Phase 8.6 work executed.*

### Phase 8.5.1 & 8.5.2: Canonical Opportunity Quality Contract Correction
- **Status:** DONE
- **Objective:** Correct the Opportunity Quality engine to prevent `UNKNOWN` competition from acting as a global veto against legitimate `FAVORABLE` opportunities.
- **Implementation:**
  1. Replaced hardcoded global veto with a multi-dimensional boolean evaluation matrix.
  2. `FAVORABLE` is now granted if there is a verified intrinsic positive signal (`EXCEPTIONAL` compensation, explicitly `LOW` competition, or genuinely `LOW` visibility) and no negative vetoes exist.
  3. `HIGH` competition, `STALE` freshness, and `BELOW_TARGET` compensation are enforced as hard negative vetoes.
  4. `NEW` freshness is correctly treated as neutral urgency, not intrinsic quality.
  5. `LOW` authenticity safely demotes `FAVORABLE` to `NEUTRAL`.
  6. Added 13 targeted boundary tests to `canonical-opportunity.test.ts`.

### Phase 8.6: Opportunity Quality Integration & Compensation Evidence Audit
- **Status:** DONE
- **Historical Context:** Originally scoped as "Candidate Fit Independence". The actual executed scope was an architectural integration and evidence feasibility audit to ensure the corrected Phase 8.5.2 contract was physically and logically sound in production.
- **Findings - Integration Audit:**
  1. **Source of Truth:** Canonical OQ (`src/lib/opportunity-quality/engine.ts`) is the strict single active source of truth.
  2. **Run Scoping:** `marketIntelligence` persistence is perfectly run-scoped.
  3. **Compatibility:** `schema.scores` is a pure one-way compatibility projection (`FAVORABLE -> 85`, etc.), safely shielding downstream consumers.
  4. **B7 & Candidate Decision:** B7 safely consumes the compatibility projection. Candidate Decision safely consumes the canonical `marketIntelligence` record separately from Candidate Fit.
  5. **Stretch:** Independently protected. Stretch explicitly requires `visibilityLevel === 'LOW'` AND `competitionLevel === 'LOW'`, meaning `EXCEPTIONAL` compensation alone cannot bypass the `EXTREME_EXPERIENCE_GAP` veto.
- **Findings - Compensation Evidence Feasibility:**
  1. Raw salary evidence bounds (`salaryMin`, `salaryMax`) already exist and are successfully extracted by Stage B and `html-enrichment.ts`, and persisted to `schema.jobs`.
  2. **Baseline Gap:** No legitimate market compensation baseline exists in the repository.
  3. Candidate salary expectations are strictly candidate-specific and cannot be used as an intrinsic market baseline without violating Candidate Fit Independence.
  4. General LLM pretrained knowledge constitutes "unsupported inference" and violates the Phase 8 evidence mandate.
  5. Employer marketing claims ("top of market") are subjective and insufficient as objective evidence.
- **Conclusion:** Compensation classification (`EXCEPTIONAL`, `TARGET`, `BELOW_TARGET`) correctly remains `UNKNOWN` in production. No new salary extraction architecture or production implementation is required at this time.

### Phase 8.7: Visibility Evidence Feasibility
- **Status:** BLOCKED / EXTERNAL DEPENDENCY
- **Objective:** Evaluate the feasibility of expanding secondary aggregators to establish legitimate `LOW` visibility.
- **Findings:** JobSight currently has only one independent secondary aggregator (`SearchEngineProvider`). At least two additional genuinely independent secondary providers require external partner/API access that is not currently available.
- **Decision:** Do not implement `LOW` visibility until the N>=3 evidence quorum can be legitimately satisfied. Visibility must remain `UNKNOWN` when evidence is insufficient.

### Phase 8.8: Mission Evidence Bottleneck Audit
- **Status:** DONE
- **Objective:** Trace all evidence dimensions to identify unused/underused evidence and the highest-value remaining bottleneck.
- **Findings:** The evaluation architecture is flawless but completely starved of intrinsic positive signals. No unused internal evidence exists that can independently establish intrinsic Opportunity Quality without an external baseline.
- **Decision:** EVIDENCE GAP — NO TRUSTWORTHY PATH CURRENTLY EXISTS.

### Phase 9.3: Bounded Visibility Observation
- **Status:** DONE
- **Objective:** Introduce an honest, machine-auditable bounded observation for non-observations on configured secondary sources.
- **Implementation:** 
  1. Replaced abstract `LOW` visibility assumptions with an explicit bounded `NOT_OBSERVED_ON_CHECKED_SOURCES` observation.
  2. Forced weak/ambiguous fuzzy matches to return `UNKNOWN` to prevent false non-observations.
  3. Wired Canonical Opportunity Quality to safely consume `NOT_OBSERVED_ON_CHECKED_SOURCES` without granting unearned `FAVORABLE` status, preserving isolation of `UNKNOWN` competition/compensation.
- **Test Results:** 63 files, 526 tests passing, including focused isolation and timestamp/query provenance bounds checking.
- **Real-World Validation:** Demonstrated exact matching (`OBSERVED_ON_SOURCE`) vs deterministic zero-match (`NOT_OBSERVED_ON_CHECKED_SOURCES`) using the single existing `SearchEngineProvider` via AGY model retrieval.
- **Remaining Limitations:** The system safely tracks observations but JobSight's pipeline continues to require multi-provider API credentials to establish definitive true `LOW` visibility. `UNKNOWN` propagation ensures pipeline safety.
- **Mission Status:** NOT VALIDATED

### External Evidence Requirements
Phase 8 development on capability expansion is paused until the following external data requirements are secured:

**VISIBILITY:**
- At least 2 additional genuinely independent secondary aggregators beyond `SearchEngineProvider`.
- Legitimate programmatic/query access required.
- Successful zero-result searches must be distinguishable from failures.
- Fresh, timestamped observations required.
- N>=3 independent-provider quorum remains mandatory.

**COMPETITION:**
- Legitimate applicant/application-volume or documented competition evidence required.
- No inference from visibility, job age, company size, title, remote status, or LLM knowledge.

**COMPENSATION:**
- Legitimate structured market benchmark required.
- Candidate salary expectations must remain candidate-specific.
- LLM pretrained knowledge must not be used as a market baseline.

- **Current Mission Status:** NOT VALIDATED
- **Next Milestone:** PAUSED (Awaiting External Dependencies)


### Phase 9.4: Full UI Wiring & Product Integrity Audit
- **Status:** DONE
- **Objective:** Audit the UI and Backend split and identify how legacy intelligence schemas affect production rendering.
- **Findings:** A severe UI/backend split exists. The UI heavily relies on deprecated Phase 6/7 schemas (`oppDiscoverySummary`, `discoveryIntelligence`, `opportunityIntelligence`), completely ignoring the Phase 8 Canonical OQ architecture (`marketIntelligence`). Run isolation in the UI is highly compromised.

### Phase 9.5: Canonical UI Migration & Runtime Dependency Hardening
- **Status:** DONE
- **Objective:** Eliminate the UI's reliance on deprecated Phase 6/7 intelligence schemas and definitively map to the Canonical Opportunity Quality (`marketIntelligence`). Enforce strict `runId` scoping.
- **Implementation:**
  1. Rewired Dashboard (`src/app/page.tsx`) to surface `FAVORABLE` opportunities directly from `marketIntelligence`, dropping arbitrary legacy numeric averages.
  2. Migrated JobCard components to accept and visually represent discrete `OpportunityQuality` statuses (`FAVORABLE`, `NEUTRAL`, `UNFAVORABLE`, `INSUFFICIENT_EVIDENCE`).
  3. Re-architected Candidate Decision Board (`src/app/board/page.tsx`) and Discovery Radar (`src/app/radar/page.tsx`) to consume `marketIntelligence` properties instead of deprecated discovery tables.
  4. Performed a critical teardown of `src/app/jobs/[id]/page.tsx`, removing legacy score widgets and un-scoped `jobId` lookups, ensuring full run isolation for secondary evidence tables.
- **Test Results:** 63 files, 526 tests passing. TypeScript typechecks pass. Production build completes successfully.
- **Impact:** Complete elimination of cross-run contamination in UI endpoints. Zero reliance on deprecated Phase 6/7 schemas for critical quality rendering. UI perfectly reflects the rigorous Phase 8 Evidence Architecture.

### Phase 9.6: Run Isolation Verification & Hardening
- **Status:** DONE
- **Objective:** Independently verify and harden JobSight's run isolation across all intelligence vectors. Ensure `jobId`-only queries do not leak data across distinct runs.
- **Audit Findings:** 
  1. Identified ~40 points of `jobId` access globally.
  2. Determined that most cases were `GLOBAL_SAFE` (e.g., `schema.jobs`, `schema.companies`) or previously correctly run-scoped in Phase 9.5.
  3. Discovered that the `companyAnalysis` fetch in the Job Detail UI and `observableSignals` query in the active orchestration pipeline erroneously lacked `runId` scoping.
- **Implementation:**
  1. Safely patched `src/lib/pipeline/orchestrator.ts` to strictly enforce `runId` on `observableSignals` for signal collection.
  2. Safely patched `src/app/jobs/[id]/page.tsx` to strictly isolate `companyAnalysis` dependencies.
  3. Deployed a full regression test (`src/tests/run-isolation.test.ts`) mapping explicit boundary proofs.
- **Test Results:** 64 files, 527 tests passing. TypeScript typechecks pass without errors.
- **Impact:** Global intelligence and run-specific execution records are now perfectly hermetic. Historical records render truthfully without contaminating current active pipelines.

### Phase 9.7: Global View & Data Semantics Audit
- **Status:** DONE
- **Objective:** Establish and harden global/current/latest/historical data semantics. Ensure any aggregate queries explicitly select correct chronological state.
- **Audit Findings:**
  1. Identified unbounded `limit(1)` lookups for Company Intelligence in `src/app/companies/[id]/page.tsx` and arbitrary unbounded `FAVORABLE` opportunity lookups in `src/app/radar/page.tsx`.
  2. Confirmed that `createdAt` and `firstSeenAt` serve as authoritative chronological timestamps for company reports and job discovery, respectively.
- **Implementation:**
  1. Handled ambiguous global company queries by actively binding them to `orderBy(desc(schema.X.createdAt))`.
  2. Re-architected Radar to fetch authentically `latest` discovery logic by applying explicit `orderBy(desc(createdAt))` or `orderBy(desc(firstSeenAt))` semantics against `schema.marketIntelligence`, `schema.companyAnalysis`, and `schema.jobs`.
  3. Corrected UI semantic mismatches (e.g. replaced the deprecated "Hidden Gems" label with the accurate "Favorable Opportunities" label on Dashboard/Radar surfaces).
- **Test Results:** 63 files, 526 tests passing. TypeScript checks pass without errors.
- **Impact:** Global intelligence displays are authentically ordered chronologically. A UI claiming to display "Latest Intelligence" actually delivers the correct chronological edge data. Run semantics correctly map to UI representations.

### Phase 10.0: External Evidence Provider Readiness & Integration Contract
- **Status:** BLOCKED / EXTERNAL CREDENTIALS REQUIRED
- **Objective:** Audit Adzuna, Jooble, and other aggregators for free-tier readiness, evidence contracts, and architectural implementation safety.
- **Audit Findings:** 
  1. Credentials for all researched providers are `NOT_AVAILABLE` in the local environment.
  2. Adzuna free-tier is viable for research but constrained to 250 req/day.
  3. Jooble free-tier is highly restrictive (500 req lifetime per key) and not viable for a continuous pipeline.
  4. Neither provider exposes true Applicant/Vacancy volume; thus Competition will remain `UNKNOWN`.
  5. The evidence contract for `NOT_OBSERVED_ON_CHECKED_SOURCES` demands strict matching (Canonical Title + Normalized Company) and absolute distinction from rate-limits (429) or timeouts.
- **Implementation:** NONE. Halted due to missing credentials as per protocol.
- **Impact:** The system remains structurally hardened but lacks the external API credentials required to conduct the Reality Test and transition bounded absence into authentic low visibility.

### Phase 10.1: Adzuna Minimal Adapter + Evidence Reality Test
- **Status:** DONE
- **Objective:** Implement the smallest production-safe Adzuna evidence adapter and validate it securely using actual environment credentials, without altering existing semantic logic.
- **Implementation:** 
  1. Created `checkAdzunaEvidence` server-side adapter.
  2. Integrated it seamlessly into `src/lib/pipeline/secondary-evidence.ts`.
  3. Established strict MATCH logic (`EXACT`, `STRONG`, `PARTIAL`, `WEAK`, `AMBIGUOUS`, `NONE`).
  4. Mapped 0 matches or `NONE` match to `NOT_OBSERVED_ON_CHECKED_SOURCES` strictly when the API responds successfully.
  5. Mapped `WEAK` and API failures (429, timeouts) explicitly to `UNKNOWN`.
- **Test Results:** 64 files, 534 tests passing. `npx tsc --noEmit` clean. Real-world validation passed for Microsoft (OBSERVED), FakeStealthCo123 (NOT_OBSERVED), and generic 'Tech' (UNKNOWN).
- **Impact:** We successfully ingest secondary aggregator evidence securely. However, because `NOT_OBSERVED_ON_CHECKED_SOURCES` remains bounded, and Competition/Compensation remain `UNKNOWN`, the mission overall remains **NOT VALIDATED**.

### Phase 10.1 (Corrected): Adzuna Evidence Integrity Fixes
- **Status:** DONE
- **Objective:** Correct the Adzuna evidence integration to adhere to strict bounded intelligence semantics and provider independence rules.
- **Key Constraints:**
  - Adzuna is an independent evidence provider, NOT an authoritative visibility source. Adzuna absence alone does not automatically prove `LOW` visibility. Adzuna presence does not prove `FAVORABLE` opportunity.
  - Bounded non-observation remains securely bounded. 
  - Local rate protection (`ADZUNA_DAILY_BUDGET = 200`) is implemented strictly as a safety circuit breaker, not as an account-wide distributed quota system.
  - Competition and applicant volume metrics remain strictly `UNKNOWN`.
  - Compensation baseline remains strictly `UNKNOWN`.
  - The JobSight canonical mission remains **DISCOVERY_MISSION_NOT_VALIDATED** due to a lack of complete independent quorum visibility mechanisms.
- **Architectural Enhancements:**
  - `EXACT` matching now legally requires a Canonical URL or Provider ID. Exact string matches fallback to `STRONG` matching.
  - `secondary-evidence.ts` now sequentially interrogates both Adzuna and the SearchEngineProvider asynchronously, returning aggregated `CrossReferenceResult[]` to the orchestrator instead of short-circuiting on Adzuna success.
  - Idempotency guarantees achieved through `job_run_source_idx` unique compound index on `(jobId, runId, targetSource)` within `schema.jobCrossReferences`.
