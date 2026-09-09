# Phase 13.1: Parallel Hunt Execution & Experiment Integrity Hardening

## 1. Executive Summary
This milestone corrected the execution integrity and data aggregation flaws exposed in Phase 13. A dedicated experiment runner (`run-experiment.ts`) was implemented alongside a strict JSON-based `experiment-manifest.json`. Future multi-hunt experiments now safely launch with bounded concurrency, guarantee terminal state resolution via explicit process awaiting, and isolate result aggregation strictly to the run IDs generated during the session. Historical contamination is now structurally impossible.

## 2. Root Cause
The Phase 13 premature termination was caused by a detached background process (the script runner) being killed, leaving the orchestrator's child runs stuck in `RUNNING`. Compounding this, the aggregation logic lacked an explicit experiment boundary, incorrectly using a `LIMIT 10` query which pulled in older, historical runs (e.g., from Phase 11) to fabricate a completed report.

## 3. Current Execution Architecture
The core orchestrator (`runMission`) successfully manages individual run states (`RUNNING`, `COMPLETED`, `COMPLETED_WITH_FAILURES`, `FAILED`). However, the previous caller/launcher did not properly await these or track them via a session-scoped manifest. 

## 4. Failure Mode
When the launcher was terminated prematurely, the aggregation step ran blindly on the database without verifying if the runs were actually from the same session or had reached a terminal state.

## 5. Experiment Manifest Design
An explicit, session-scoped `experiment-manifest.json` acts as the source of truth for all multi-hunt aggregation.
- It records a unique `experimentId` and the explicit `runId`s generated.
- The aggregator script (`analyze-experiment.ts`) refuses to process results unless every run in the manifest is verified against the database as terminal.
- This avoids unnecessary schema changes while providing strict audit-level isolation.

## 6. Run Lifecycle
Runs transition from `CREATED` -> `RUNNING` -> `COMPLETED`/`COMPLETED_WITH_FAILURES`/`FAILED`. The launcher script now explicitly blocks using `await Promise.all()` to ensure all runs reach their terminal status before emitting the finalized manifest.

## 7. Concurrency Design
Hunts are batched in a bounded array (safe concurrency limit: 2). One batch fully resolves its initialization and execution API requests before the next begins, respecting LLM and provider rate limits.

## 8. Failure Isolation
Each run operates independently. If Run A fails at the orchestrator level, it updates its status to `FAILED` or `COMPLETED_WITH_FAILURES`. `Promise.all` absorbs these cleanly via individual try-catch blocks, allowing Run B and Run C to continue successfully.

## 9. Aggregation Isolation
The `analyze-experiment.ts` script strictly filters decisions and jobs using `inArray(schema.decisions.runId, runIds)`. Run IDs not explicitly listed in `experiment-manifest.json` are excluded, completely eliminating historical contamination.

## 10. Test Coverage
Unit tests (`tests/experiment-isolation.test.ts`) were added to guarantee:
- Experiment A cannot read Experiment B's runs.
- Historical runs cannot contaminate the manifest.
- An incomplete experiment immediately throws an `EXPERIMENT INCOMPLETE` error if any run remains in `RUNNING`.

## 11. Real-World Smoke Test
A 3-hunt concurrent smoke test was executed successfully. The manifest properly recorded the 3 explicit run IDs, and the aggregation script successfully detected when runs were still executing, refusing to aggregate prematurely. 

## 12. UI/Database Consistency
The UI relies directly on the `schema.runs.status` column. Since the execution fixes correctly write the terminal statuses (`COMPLETED`, `COMPLETED_WITH_FAILURES`) back to the DB natively, the UI accurately reflects the true state without requiring modifications.

## 13. Run Isolation
All Candidate Decisions, Intelligence, and Candidate Fit records remain strictly run-scoped through the relational schema.

## 14. Residual Risks
If the environment (or OS) kills the entire Node process forcefully, runs will still be stranded in `RUNNING`. However, the new strict aggregation check mitigates this completely by blocking any downstream reporting until the state is manually resolved.

## 15. Recommended Phase 13 Re-run Procedure
Phase 13 should be completely re-run using `npx tsx src/scripts/run-experiment.ts` (populated with the 15 hunt configurations). The operator must wait for the script to finish and exit cleanly before running `npx tsx src/scripts/analyze-experiment.ts` to build the final report.
