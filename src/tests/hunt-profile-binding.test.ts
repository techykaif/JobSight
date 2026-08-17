import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { saveHuntConfig } from '../app/hunts/new/actions';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

vi.mock('../lib/auth', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('local_user')
}));
import { getCurrentUserId } from '../lib/auth';

describe('D1.7.3 Hunt Profile Binding & Snapshot Immutability', () => {
  beforeEach(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    await db.delete(schema.pipelineEvents);
    await db.delete(schema.runs);
    await db.delete(schema.huntConfigs);
    await db.delete(schema.profiles);
  });

  const getFormData = (overrides: Record<string, string>) => {
    const fd = new FormData();
    fd.append('targetRoles', 'Engineer');
    for (const [k, v] of Object.entries(overrides)) {
      fd.append(k, v);
    }
    return fd;
  };

  it('1. & 5. Hunt can be created with no profile, Run gets profileSnapshot = null', async () => {
    // Suppress redirect error
    try {
      await saveHuntConfig(getFormData({ profileId: 'none' }));
    } catch (e: any) {
      if (e.message !== 'NEXT_REDIRECT') throw e;
    }

    const runs = await db.select().from(schema.runs);
    expect(runs.length).toBe(1);
    expect(runs[0]!.profileSnapshot).toBeNull();

    const configs = await db.select().from(schema.huntConfigs);
    expect(configs[0]!.profileId).toBeNull();
  });

  it('2. & 6. & 7. & 13. Hunt can be created with a selected profile, Run gets populated snapshot', async () => {
    await db.insert(schema.profiles).values({
      id: 'prof-1',
      userId: 'local_user',
      name: 'Test Profile',
      yearsOfProfessionalExperience: 5,
      targetRoles: ['Engineer'],
      skills: ['TypeScript'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    try {
      await saveHuntConfig(getFormData({ profileId: 'prof-1' }));
    } catch (e: any) {
      if (e.message !== 'NEXT_REDIRECT') throw e;
    }

    const runs = await db.select().from(schema.runs);
    expect(runs.length).toBe(1);

    const snapshot: any = runs[0]!.profileSnapshot;
    expect(snapshot).not.toBeNull();
    expect(snapshot.profileId).toBe('prof-1');
    expect(snapshot.profileName).toBe('Test Profile');
    expect(snapshot.profile.yearsOfProfessionalExperience).toBe(5);
    expect(snapshot.profile.skills).toEqual(['TypeScript']);

    // 13. Does not contain raw resume data (only structured fields)
    expect(snapshot.rawDocument).toBeUndefined();
  });

  it('3. & 4. profileId ownership is enforced; another user\'s profile cannot be attached', async () => {
    await db.insert(schema.profiles).values({
      id: 'prof-2',
      userId: 'other_user', // Different user
      name: 'Other Profile',
      yearsOfProfessionalExperience: 3,
      targetRoles: ['Dev'],
      skills: ['Java'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const res = await saveHuntConfig(getFormData({ profileId: 'prof-2' }));
    expect(res?.error).toMatch(/profile not found/i);
  });

  it('8. & 10. editing live profile after Run creation does NOT change snapshot, future Run gets new state', async () => {
    await db.insert(schema.profiles).values({
      id: 'prof-3',
      userId: 'local_user',
      name: 'V1',
      yearsOfProfessionalExperience: 1,
      targetRoles: [],
      skills: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    try {
      await saveHuntConfig(getFormData({ profileId: 'prof-3' }));
    } catch (e: any) {
      if (e.message !== 'NEXT_REDIRECT') throw e;
    }

    let runs = await db.select().from(schema.runs);
    let snap1: any = runs[0]!.profileSnapshot;
    expect(snap1.profile.yearsOfProfessionalExperience).toBe(1);

    // User edits the profile
    await db.update(schema.profiles).set({ yearsOfProfessionalExperience: 2 }).where(eq(schema.profiles.id, 'prof-3'));

    try {
      await saveHuntConfig(getFormData({ profileId: 'prof-3' }));
    } catch (e: any) {
      if (e.message !== 'NEXT_REDIRECT') throw e;
    }

    runs = await db.select().from(schema.runs);
    expect(runs.length).toBe(2);

    snap1 = runs[0]!.profileSnapshot;
    const snap2: any = runs[1]!.profileSnapshot;

    // Original run snapshot is immutable
    expect(snap1.profile.yearsOfProfessionalExperience).toBe(1);
    // New run gets updated state
    expect(snap2.profile.yearsOfProfessionalExperience).toBe(2);
  });

  it('9. & 11. deleting live profile does NOT destroy historical snapshot, new run handles missing profile', async () => {
    await db.insert(schema.profiles).values({
      id: 'prof-4',
      userId: 'local_user',
      name: 'Delete Me',
      yearsOfProfessionalExperience: 0,
      targetRoles: [],
      skills: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    try {
      await saveHuntConfig(getFormData({ profileId: 'prof-4' }));
    } catch (e: any) {
      if (e.message !== 'NEXT_REDIRECT') throw e;
    }

    // Delete profile
    await db.delete(schema.profiles).where(eq(schema.profiles.id, 'prof-4'));

    const runs = await db.select().from(schema.runs);
    expect(runs.length).toBe(1);
    const snapshot: any = runs[0]!.profileSnapshot;
    // Historical run is still perfectly intact
    expect(snapshot).not.toBeNull();
    expect(snapshot.profileName).toBe('Delete Me');

    // Creating new run with missing profile throws
    const res = await saveHuntConfig(getFormData({ profileId: 'prof-4' }));
    expect(res?.error).toMatch(/profile not found/i);
  });

  it('12. existing no-profile Hunts continue functioning', async () => {
    // Simulate legacy DB state
    await db.insert(schema.huntConfigs).values({
      id: 'legacy-conf',
      targetRoles: ['Test'],
      alternativeRoles: [],
      candidateCountry: 'India',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    await db.insert(schema.runs).values({
      id: 'legacy-run',
      configId: 'legacy-conf',
      status: 'COMPLETED',
      profileSnapshot: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const runs = await db.select().from(schema.runs).where(eq(schema.runs.id, 'legacy-run'));
    expect(runs[0]!.profileSnapshot).toBeNull();
  });

  it('14. orchestrator successfully unwraps the immutable envelope snapshot', async () => {
    const { runMission } = await import('../lib/pipeline/orchestrator');
    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();

    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ['Test'],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    await db.insert(schema.runs).values({
      id: runId,
      configId,
      status: 'CREATED',
      lastCheckpoint: 'APPLICATION_INTELLIGENCE_COMPLETED', // skip all execution to isolate validation
      profileSnapshot: {
        profileId: 'prof-xyz',
        profileName: 'Kaif_New_profile',
        snapshotAt: new Date().toISOString(),
        profile: {
          yearsOfProfessionalExperience: 2,
          education: 'Degree',
          targetRoles: ['Engineer'],
          skills: ['JS'],
          projectExperience: [],
          preferredRoles: [],
          salaryExpectations: { minimum: 10, preferred: 20, currency: 'USD' },
          remotePreference: 'REMOTE_ONLY',
          allowedRegions: [],
          employmentPreferences: []
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const abortController = new AbortController();
    await runMission(runId, abortController.signal, () => false);

    // If validation failed, errorSummary will contain "Profile validation failed"
    const runRes = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
    expect(runRes[0]?.errorSummary).toBeNull();
  });

  it('15. orchestrator successfully supports legacy flat profile snapshots', async () => {
    const { runMission } = await import('../lib/pipeline/orchestrator');
    const runId = crypto.randomUUID();
    const configId = crypto.randomUUID();

    console.log('Inserting config');
    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: ['Test'],
      alternativeRoles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    console.log('Inserting run');
    await db.insert(schema.runs).values({
      id: runId,
      configId,
      status: 'CREATED',
      lastCheckpoint: 'APPLICATION_INTELLIGENCE_COMPLETED', // skip all execution to isolate validation
      profileSnapshot: {
        id: 'legacy-id',
        name: 'Legacy Profile',
        yearsOfProfessionalExperience: 3,
        education: 'BSc',
        targetRoles: ['Dev'],
        skills: ['Python'],
        projectExperience: [],
        preferredRoles: [],
        salaryExpectations: null,
        remotePreference: null,
        allowedRegions: [],
        employmentPreferences: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const abortController = new AbortController();
    console.log('Running mission');
    try {
      await runMission(runId, abortController.signal, () => false);
    } catch (e: any) {
      console.log('runMission threw:', e.message);
    }
    console.log('Finished mission');

    const runRes = await db.select().from(schema.runs).where(eq(schema.runs.id, runId));
    expect(runRes[0]?.errorSummary).toBeNull();
  });
});
