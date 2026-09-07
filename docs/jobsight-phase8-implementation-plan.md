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
- **Next Milestone:** Phase 8.5 (Competition & Applicant Volume Intelligence)

