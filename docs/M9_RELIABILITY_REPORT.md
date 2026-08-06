# MILESTONE 9: RELIABILITY, RECOVERY & DEDUPLICATION REPORT

## 1. Overview
Milestone 9 focuses on making the autonomous pipeline resilient and robust for repeated, real-world use. This involves adding checkpointing, process restart reconciliation, robust run locking/leasing, advanced job identity resolution (URL normalization, external IDs), stale job/reappearance tracking, and centralized failure classification and persistent retry limits.

## 2. Implementations Completed
1. **Durable Mission Checkpoints**
   - Refactored `orchestrator.ts` to log checkpoints (`PREFLIGHT_COMPLETED`, `DISCOVERY_COMPLETED`, `QUALIFICATION_COMPLETED`, `COMPANY_RESEARCH_COMPLETED`).
   - On start, the orchestrator bypasses completed stages, safely resuming operations.

2. **Process Restart Detection & Startup Reconciliation**
   - `missionManager.ts` has a `reconcileInterruptedRuns` method designed to be called at application startup.
   - It finds stale leases and marks active runs as `INTERRUPTED`.

3. **Run Locking & Leases**
   - Active runs use an `executorId` and `leaseExpiresAt`.
   - `missionManager` maintains a background heartbeat. 
   - Concurrent process conflicts are blocked by deterministic lease checks.

4. **Job Identity & URL Normalization**
   - Standardized `normalizeUrl` and `normalizeTitle`.
   - Added support for `externalJobId`.

5. **Advanced Idempotency & Reappearance**
   - Pre-ingestion db checking ensures duplicate jobs (by Canonical URL or External ID) are updated.
   - Status updates are triggered if a closed job reappears as `ACTIVE`.

6. **Possible Repost Detection**
   - If a job doesn't match by URL/External ID but shares the exact Company and Normalized Title, the system persists it as a new candidate but emits a `POSSIBLE_REPOST_DETECTED` event.

7. **Failure Classification & Persistence**
   - The orchestrator explicitly monitors and checks failures within `failures` table for `QUALIFY` and `COMPANY` stages.
   - If a job or company fails to process, it records an attempt. Upon restarting the mission, it will retry up to a hard limit (e.g. 2 attempts). 
   - Exhausted retries emit `RETRY_EXHAUSTED` and the entity is safely bypassed in future runs.

## 3. Verification
A dedicated end-to-end recovery simulation was created at `src/scripts/m9-recovery-test.ts`. 
Running `npm run milestone:9` successfully demonstrates:
- A process starts and reaches the discovery phase.
- An unexpected crash is simulated (lease expiration is triggered).
- A simulated restart triggers `reconcileInterruptedRuns`, transitioning the run to `INTERRUPTED`.
- Resuming the run properly reads the checkpoint (`PREFLIGHT_COMPLETED`) and correctly restarts the exact stage without repeating completed work.
- Unit tests (`npm test`) confirm the system integrations remain structurally sound.

**Status:** ALL M9 OBJECTIVES ACCOMPLISHED.
