import { describe, it, expect, beforeAll, vi } from 'vitest';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { missionManager } from '../lib/pipeline/missionManager';

describe('Milestone 8: Mission Orchestrator & State Machine', () => {
  let testRunId: string;
  let testConfigId: string;

  beforeAll(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });

    testConfigId = crypto.randomUUID();
    await db.insert(schema.huntConfigs).values({
      id: testConfigId,
      targetRoles: ['Backend Engineer'],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Ensure at least one profile exists
    await db.insert(schema.profiles).values({
      id: crypto.randomUUID(),
      name: 'Test',
      yearsOfProfessionalExperience: 5,
      targetRoles: [],
      skills: [],
      projectExperience: [],
      education: 'BSc',
      preferredRoles: [],
      remotePreference: 'HYBRID_ACCEPTABLE',
      allowedRegions: [],
      employmentPreferences: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).onConflictDoNothing();
  });

  it('enforces single active mission', async () => {
    const run1 = crypto.randomUUID();
    const run2 = crypto.randomUUID();

    await db.insert(schema.runs).values([
      { id: run1, configId: testConfigId, status: 'CREATED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: run2, configId: testConfigId, status: 'CREATED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);

    await missionManager.start(run1);
    
    // Attempting to start run2 should fail synchronously
    await expect(missionManager.start(run2)).rejects.toThrow(/already active/);
    
    await missionManager.cancel(run1);
  });

  it('can pause and resume cooperatively', async () => {
    const runId = crypto.randomUUID();
    
    await db.insert(schema.runs).values({
      id: runId, configId: testConfigId, status: 'CREATED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    await missionManager.start(runId);
    
    expect(missionManager.getActiveRunId()).toBe(runId);
    
    await missionManager.pause(runId);
    expect(missionManager.isPauseRequested()).toBe(true);

    await missionManager.resume(runId);
    expect(missionManager.isPauseRequested()).toBe(false);

    await missionManager.cancel(runId);
  });

  it('cancels and terminates correctly', async () => {
    const runId = crypto.randomUUID();
    await db.insert(schema.runs).values({
      id: runId,
      configId: testConfigId,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await missionManager.cancel(runId);
    
    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
    expect(run[0]!.status).toBe('CANCELLED');
  });
});
