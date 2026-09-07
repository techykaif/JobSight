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

### Phase 8.3: (Pending Assignment)
- **Status:** LEFT

