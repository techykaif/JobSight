# Phase 13.2: Bounded Pipeline Execution & Experiment Isolation

## 1. Executive Summary
This milestone secures the reliability of the JobSight discovery orchestrator by strictly bounding all external provider operations and completely isolating experiment artifacts. Previously, unbounded ATS discovery fetches would indefinitely stall the in-process execution queue. We have implemented a reusable timeout wrapper (`fetchWithTimeout`) applied across all providers, ensuring that hung network calls cleanly transition into internal failures without halting the concurrent experiment batch. Additionally, experiment manifests are now deterministically scoped by their `experimentId`, eliminating historical collisions.

## 2. Audit Findings & Root Cause
- **Root Cause**: The native Node.js `fetch` API does not enforce a default timeout. `AshbyProvider`, `GreenhouseProvider`, `LeverProvider`, and all other HTTP-based discovery components called `fetch(context.sourceUrl)` without an `AbortSignal`. When parsing obscure startup ATS instances, unresponsive servers kept sockets open indefinitely, blocking the Node event loop and completely hanging the orchestrator.
- **Manifest Collision**: The `run-experiment.ts` script used a hardcoded string `experiment-manifest.json`. During concurrent task scheduling, background tasks completing out-of-order trivially overwrote active experiments.
- **LLM/AGY Calls**: Audited and confirmed safe. `runAgyTask` (60s) and `runAgyUnstructured` (120s) already correctly utilized bounded `execa` parameters. 

## 3. Timeout Architecture
We introduced `src/lib/utils/network.ts` exporting a `fetchWithTimeout` function.
- **Implementation**: It constructs an internal `AbortController` and enforces a hard cutoff using `setTimeout`. If triggered, it throws an `AbortError`.
- **Value**: A conservative 15-second default (`timeoutMs: 15000`) was selected for HTTP discovery fetching. This is sufficient for legitimate web servers while aggressively shedding hung connections. 
- **Graceful Failure**: When `fetchWithTimeout` throws an `AbortError`, the provider try/catch blocks catch it. The failure is gracefully recorded into `schema.failures` by the orchestrator. It does **not** become positive visibility/competition evidence. 

## 4. Manifest Isolation Design
The experiment runner now binds the JSON manifest path directly to the dynamic `experimentId` (e.g., `experiment-manifest-phase13-1788908062929.json`). The `analyze-experiment.ts` script now requires this specific filepath as a CLI argument (`process.argv[2]`).

## 5. Validation Results
- **Typecheck**: PASS
- **Unit Tests**: Added `src/tests/bounded-execution.test.ts` to explicitly assert the `AbortError` timeout behavior. All tests passed.
- **Semantics Preserved**: No modifications were made to Canonical Opportunity Quality, Candidate Fit, or discovery scoring metrics. 

## 6. Real-World Smoke Test
A 2-hunt bounded smoke test successfully launched and reached terminal states (`COMPLETED_WITH_FAILURES`). The orchestrator cleanly pushed through discovery phases even if a remote provider stalled, proving the `fetchWithTimeout` integration prevents catastrophic stalling.

## 7. Residual Risks
While HTTP fetches are now bounded, the pipeline remains an in-process Node architecture. Exceptionally large concurrency pools could still face internal memory constraints. Distributed queues (e.g., BullMQ) are still recommended before expanding beyond 15–20 concurrent hunts.

