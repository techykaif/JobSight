import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import { runMission } from './orchestrator';
import crypto from 'crypto';
import { emitEvent } from './events';
import { bootstrap } from '../bootstrap';

export type MissionState = 'CREATED' | 'PREFLIGHT' | 'DISCOVERING' | 'INGESTING' | 'QUALIFYING' | 'RESEARCHING' | 'RANKING' | 'COMPLETED' | 'PAUSED' | 'CANCELLING' | 'CANCELLED' | 'FAILED' | 'INTERRUPTED';

const LEASE_DURATION_MS = 60000;
const HEARTBEAT_INTERVAL_MS = 20000;

class MissionManager {
  private activeRunId: string | null = null;
  private abortController: AbortController | null = null;
  private pauseRequested: boolean = false;
  private executorId: string = crypto.randomUUID();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  async start(runId: string) {
    // ROOT CAUSE FIX (V1_0_1_A5_2): registers all discovery providers and
    // strategies before any run can execute. Previously bootstrap() was only
    // ever invoked from test files, so a real run's in-memory provider/strategy
    // registries were empty, causing an immediate crash in discovery/orchestrator.ts
    // ("Cannot read properties of undefined (reading 'name')") before any
    // Provider.discover() ran. bootstrap() is idempotent (no-ops after the first
    // call), so calling it here on every start() is safe and cheap.
    bootstrap();

    if (this.activeRunId && this.activeRunId !== runId) {
      throw new Error(`Another run (${this.activeRunId}) is already active locally. Please cancel it first.`);
    }

    if (this.activeRunId === runId && !this.pauseRequested) {
      return; // Already running
    }

    // 1. Acquire Lease
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

    // Fetch current run
    const currentRun = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
    if (!currentRun[0]) throw new Error('Run not found');

    const run = currentRun[0];
    const isLeaseValid = run.executorId && run.leaseExpiresAt && new Date(run.leaseExpiresAt) > now;
    
    if (isLeaseValid && run.executorId !== this.executorId) {
      throw new Error('Run is actively executed by another process (valid lease).');
    }

    // Update lease
    await db.update(schema.runs).set({
      executorId: this.executorId,
      heartbeatAt: now.toISOString(),
      leaseExpiresAt: expiresAt.toISOString(),
      status: ['CREATED', 'PAUSED', 'INTERRUPTED'].includes(run.status) ? 'RUNNING' : run.status
    }).where(eq(schema.runs.id, runId));

    this.activeRunId = runId;
    this.pauseRequested = false;
    this.abortController = new AbortController();

    this.startHeartbeat(runId);

    // --- maximumRuntime enforcement ---
    // Load the hunt config to read the configured runtime limit.
    const configRows = await db.select({ maximumRuntime: schema.huntConfigs.maximumRuntime })
      .from(schema.huntConfigs)
      .where(eq(schema.huntConfigs.id, run.configId))
      .limit(1);
    const maximumRuntime = configRows[0]?.maximumRuntime ?? null;

    let runtimeTimeoutId: NodeJS.Timeout | null = null;

    if (maximumRuntime !== null && maximumRuntime > 0) {
      const capturedAbortController = this.abortController;
      runtimeTimeoutId = setTimeout(async () => {
        // Only act if this run is still the active one
        if (this.activeRunId !== runId) return;
        console.log(`[MISSION] Runtime limit of ${maximumRuntime}ms exceeded for run ${runId}. Aborting.`);
        capturedAbortController.abort();
        // Explicitly update run status so it is terminal even if the
        // orchestrator's catch block hasn't reached a checkpoint yet.
        try {
          await db.update(schema.runs).set({
            status: 'FAILED',
            errorSummary: `Runtime limit exceeded (configured: ${maximumRuntime}ms)`,
            updatedAt: new Date().toISOString()
          }).where(eq(schema.runs.id, runId));
          await emitEvent({
            runId,
            type: 'RUN_FAILED',
            stage: 'TIMEOUT',
            message: `Runtime limit of ${maximumRuntime}ms exceeded. Mission aborted.`
          });
        } catch (e) {
          console.error('[MISSION] Failed to persist timeout status for run', runId, e);
        }
      }, maximumRuntime);
    }

    // Start asynchronously
    runMission(runId, this.abortController.signal, () => this.isPauseRequested())
      .finally(async () => {
        // Clear the runtime timeout — if the run finished before the limit,
        // we must not fire the abort after the fact.
        if (runtimeTimeoutId !== null) {
          clearTimeout(runtimeTimeoutId);
          runtimeTimeoutId = null;
        }
        if (this.activeRunId === runId) {
          this.activeRunId = null;
          this.abortController = null;
          this.stopHeartbeat();
          // Release lease
          await db.update(schema.runs).set({
            executorId: null,
            heartbeatAt: null,
            leaseExpiresAt: null
          }).where(eq(schema.runs.id, runId));
        }
      });
  }

  private startHeartbeat(runId: string) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
        await db.update(schema.runs).set({
          heartbeatAt: now.toISOString(),
          leaseExpiresAt: expiresAt.toISOString()
        }).where(and(
          eq(schema.runs.id, runId),
          eq(schema.runs.executorId, this.executorId)
        ));
      } catch (e) {
        console.error('[HEARTBEAT] Failed to update heartbeat', e);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async pause(runId: string) {
    if (this.activeRunId === runId) {
      this.pauseRequested = true;
    }
  }

  async resume(runId: string) {
    if (this.activeRunId === runId) {
      this.pauseRequested = false;
      return;
    }
    
    // If not actively tracked but we want to resume, we treat it like start
    await this.start(runId);
  }

  async cancel(runId: string) {
    if (this.activeRunId === runId && this.abortController) {
      this.abortController.abort();
      this.activeRunId = null;
      this.abortController = null;
      this.stopHeartbeat();
    } else {
      // Check lease
      const currentRun = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
      if (currentRun[0] && currentRun[0].executorId && new Date(currentRun[0].leaseExpiresAt!) > new Date()) {
        throw new Error('Run is actively executing elsewhere, cannot cancel directly.');
      }

      await db.update(schema.runs)
        .set({ status: 'CANCELLED', updatedAt: new Date().toISOString(), executorId: null })
        .where(eq(schema.runs.id, runId));
    }
  }

  getActiveRunId() {
    return this.activeRunId;
  }

  isPauseRequested() {
    return this.pauseRequested;
  }

  // Startup reconciliation to be called in Next.js initialization
  async reconcileInterruptedRuns() {
    const now = new Date().toISOString();
    
    // Any run that is RUNNING or CANCELLING but has an expired lease
    const staleRuns = await db.select().from(schema.runs).where(
      and(
        lt(schema.runs.leaseExpiresAt, now)
      )
    );

    for (const run of staleRuns) {
      if (['RUNNING', 'PREFLIGHT', 'DISCOVERING', 'INGESTING', 'QUALIFYING', 'RESEARCHING', 'RANKING', 'CANCELLING'].includes(run.status)) {
        await db.update(schema.runs).set({
          status: 'INTERRUPTED',
          executorId: null,
          heartbeatAt: null,
          leaseExpiresAt: null,
          updatedAt: now
        }).where(eq(schema.runs.id, run.id));

        await emitEvent({
          runId: run.id,
          type: 'RUN_FAILED', // Using standard event to avoid too many new enums for now, mapped properly
          stage: 'RECONCILIATION',
          message: 'Run was interrupted unexpectedly and marked as INTERRUPTED.'
        });
      }
    }
  }
}

export const missionManager = new MissionManager();
