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

- **Current Mission Status:** NOT VALIDATED
- **Next Milestone:** Phase 8.7 (To Be Determined)

