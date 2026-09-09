# Phase 13 UI Integrity Fix: Decision Board Mapping & NaN Rendering

## 1. Overview
During the pre-benchmark validation for Phase 13, two major UI integrity issues were identified and resolved:
1. **Dashboard ↔ Decision Board Mapping Mismatch:** The Dashboard metrics and the Decision Board columns displayed conflicting job counts (e.g., Dashboard `Monitor: 0` vs Board `Monitor: 17`).
2. **React Runtime NaN Warning:** Numeric evaluations were failing gracefully in JS but pushing `NaN` text strings into React children due to unsafe database field formatting and calculations.

## 2. Root Cause Analysis

### 2.1 Decision Mapping Mismatch
The mismatch was caused by differing interpretations of the raw database queries:
- **`Rejected` Count Bug:** The Dashboard calculated rejected jobs using `.find()` on the candidate decisions aggregate: `cdRes.find(d => d.finalDecision === 'SKIP' || d.finalDecision === 'INELIGIBLE')`. `.find()` only returns the first matching element, meaning it only counted `SKIP` *or* `INELIGIBLE` depending on which appeared first, effectively ignoring the other bucket.
- **`Monitor` Count Bug:** The Decision Board uses a `LEFT JOIN` and buckets jobs via `(j.finalDecision || 'PENDING') === 'PENDING'`, meaning any job observed in the run that *does not* have an explicitly calculated candidate decision is treated as `Monitor`. The Dashboard, however, only queried the explicit `PENDING` rows in the `candidateDecisions` table, missing all un-evaluated jobs.

### 2.2 NaN Rendering
The `NaN` warnings originated from multiple locations where raw or missing DB data was forced into numeric operations without validation:
- `jobAge(firstSeenAt)` in the Dashboard and Filter pages computed arithmetic on malformed or empty Date objects.
- `SalaryBadge` blindly used `(val / 1000).toFixed(0)`, which cascaded `NaN` directly to the DOM if `val` was `NaN` or a bad cast.
- `SalaryDisplay` and `ProgressBar` exhibited similar `toFixed()` vulnerabilities.
- `ScoreGauge` used `Math.max(0, Math.min(100, score))` which propagates `NaN` when `score` is `NaN`.

## 3. Implementations & Fixes

### 3.1 Authoritative Decision Mapping
Created `src/lib/candidate-decision/mapping.ts` to act as the single source of truth for mapping database representations to UI categories.
- Both the Decision Board and the Dashboard now use `toUICategory(finalDecision)`.
- Replaced the Dashboard's manual counts to explicitly handle the `LEFT JOIN` gap for the `Monitor` column (observed jobs without a candidate decision row).
- Fixed the `Rejected` count by explicitly summing the `SKIP` and `INELIGIBLE` aggregations.

### 3.2 Safe Numeric Utilities
Created `src/lib/utils/safe-number.ts` providing guaranteed safety for numeric operations against bad data:
- `safeNumber`: Ensures a fallback is returned if the input evaluates to `NaN` or `Infinity`.
- `safeRound` & `safeFixed`: Replaces raw `Math.round` and `.toFixed()` to prevent `"NaN"` text rendering.
- `safeJobAge`: Safely guards date-math and returns predictable fallback values.

All affected components (`SalaryBadge`, `SalaryDisplay`, `ProgressBar`, `ScoreGauge`, and `page.tsx` inline helpers) were retrofitted to use these utilities.

## 4. Validation
- **Regression Testing:** A dedicated test suite (`src/tests/phase13-ui-integrity.test.ts`) covering all 15 conditions was added and integrated into the CI flow. Tests strictly enforce the categorical mapping, numerical guarantees, and count alignments.
- **Type Safety:** Corrected type assertions and array definitions causing `TS2532` (possible undefined) inside the bucket sorting loops.
- **Build Passing:** Confirmed `Next.js` successfully builds with these modifications intact and benchmark-isolated.

The `Phase 13` benchmark is now safe to proceed.
