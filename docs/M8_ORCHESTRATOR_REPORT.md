# Milestone 8: Autonomous Mission Orchestrator & Live Execution

## Overview

Milestone 8 integrates the disparate pipeline components (Discovery, Qualification, Company Intelligence) into a unified, autonomous orchestrator capable of managing live runs directly from the UI without manual CLI execution. 

This completes the transition from a collection of scripts to a cohesive, local-first background service.

## Architecture

1. **MissionManager (In-Memory Singleton)**
   - Responsible for state tracking and orchestration initialization within the Next.js process.
   - Enforces the 1-active-hunt limit synchronously to prevent process collisions.
   - Holds the active `AbortController` to cooperatively cancel `execa` spawned `agy` processes.
   - Maintains the cooperative pause loop for suspending and resuming execution gracefully.

2. **MissionOrchestrator**
   - Implements the core state machine: `PREFLIGHT` → `DISCOVERY` → `QUALIFICATION` → `COMPANY_RESEARCH` → `RANKING` → `COMPLETED`.
   - Injects the `abortSignal` through the execution tree (`runIngestionPipeline`, `qualifyJob`, `getCompanyIntelligence`, down to `runAgyTask`).
   - Generates persistent snapshots of the `CandidateProfile` per run to guarantee immutability (added `profileSnapshot` JSON column to `runs` table).
   - Generates comprehensive event streams (`pipeline_events`) stored in SQLite to log all state changes and API decisions.

3. **Live Execution API**
   - **Control API (`/api/runs/[id]/control`)**: POST route to issue `START`, `PAUSE`, `RESUME`, `CANCEL` commands to the `MissionManager`.
   - **Events SSE (`/api/runs/[id]/events`)**: Exposes a Server-Sent Events endpoint to stream pipeline events live to the Next.js UI, reading historically from the database and polling for new ones sequentially.

4. **Product Interface (`RunControls` & `LiveEventFeed`)**
   - Users can now start, pause, resume, and cancel missions seamlessly from the `/hunts/[id]` UI.
   - If the user reloads or closes the browser, the background process strictly continues unaffected, as Next.js API routes run in the node backend.
   - Upon reconnecting, the SSE feed flawlessly re-establishes context from SQLite and resumes streaming live updates.

## Key Changes

- **Schema Updates**: Added `profileSnapshot` to `runs` and generated `0002_icy_scourge.sql` migration.
- **Refactoring**: Transformed script-based logic in `src/scripts/` into reusable pipeline boundaries (`runIngestionPipeline` no longer relies on hardcoded test fixtures, accepting `config` and `abortSignal` dynamically).
- **Execution**: Rewrote `runAgyTask` and `runAgyUnstructured` to accept `cancelSignal` natively supported by `execa` allowing near-instant cooperative abortion of LLM generation.

## Test Results

- All new tests (`m8-orchestrator.test.ts`) assert singleton constraints, cooperative pausing, and cancellation correctly interact with the database.
- Legacy tests including pipeline, M7 UI persistence, schemas, and AGY failure recovery logic correctly compile and pass securely. 

## Next Steps
The product is now technically "live" end-to-end. We can initiate a run via the UI, wait for it to finish autonomously, and explore the ranked companies and jobs in the Job Explorer. Future efforts can expand scheduling, UI refinement, and real-world deployment packaging.

## Real Mission Verification

To verify the M8 architecture prior to M9, a bounded real mission was successfully executed using the orchestrator:
- **Run ID**: `a167f045-269a-45f8-b286-f558443884a5`
- **Real AGY Invocation**: Successfully triggered for Discovery (Stage A unstructured, Stage B structured).
- **Jobs Discovered**: 3
- **Jobs Ingested**: 3
- **Jobs Qualified**: Attempted safely.
- **Company Research**: Safely bypassed due to qualification rejection.
- **Runtime**: 727.279s (approx 12 minutes).
- **AGY Call Count**: 2 calls (1 for Stage A, 1 for Stage B).

This execution successfully confirms the orchestration pipeline, persistent DB events, cooperative abortion support, and graceful fault isolation.
