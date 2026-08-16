import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import { getProfiles, getProfile, saveProfile, deleteProfile } from '../app/profile/actions';
import { eq } from 'drizzle-orm';
import * as auth from '../lib/auth';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

// Mock the auth module to control userId in tests
vi.mock('../lib/auth', () => ({
  getCurrentUserId: vi.fn(),
}));

describe('D1.7.1 Profile CRUD & Ownership Isolation', () => {
  beforeEach(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    // Clear profiles table before each test
    await db.delete(schema.profiles);
    vi.clearAllMocks();
  });

  it('creates and lists multiple profiles belonging to the same user', async () => {
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    
    // Profile 1
    const form1 = new FormData();
    form1.append('name', 'Frontend Engineer');
    form1.append('targetRoles', 'React, Next.js');
    await saveProfile(form1);

    // Profile 2
    const form2 = new FormData();
    form2.append('name', 'Backend Engineer');
    form2.append('targetRoles', 'Node.js, Express');
    await saveProfile(form2);

    const profiles = await getProfiles();
    expect(profiles.length).toBe(2);
    expect(profiles.map(p => p.name).sort()).toEqual(['Backend Engineer', 'Frontend Engineer']);
    expect(profiles[0]!.userId).toBe('user_a');
  });

  it('updates an existing profile cleanly preserving data integrity', async () => {
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    
    const form1 = new FormData();
    form1.append('name', 'Old Name');
    form1.append('yearsOfProfessionalExperience', '3');
    await saveProfile(form1);

    const profiles = await getProfiles();
    const createdId = profiles[0]!.id;

    // Update
    const formUpdate = new FormData();
    formUpdate.append('id', createdId);
    formUpdate.append('name', 'New Name');
    formUpdate.append('yearsOfProfessionalExperience', '5');
    formUpdate.append('education', 'BSc');
    formUpdate.append('skills', 'React, TS');
    await saveProfile(formUpdate);

    const updated = await getProfile(createdId);
    expect(updated?.name).toBe('New Name');
    expect(updated?.yearsOfProfessionalExperience).toBe(5);
    expect(updated?.education).toBe('BSc');
    expect(updated?.skills).toEqual(['React', 'TS']);
  });

  it('deletes a profile successfully', async () => {
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    
    const form = new FormData();
    form.append('name', 'To Delete');
    await saveProfile(form);

    const profilesBefore = await getProfiles();
    expect(profilesBefore.length).toBe(1);

    const result = await deleteProfile(profilesBefore[0]!.id);
    expect(result.success).toBe(true);

    const profilesAfter = await getProfiles();
    expect(profilesAfter.length).toBe(0);
  });

  it('enforces ownership isolation: users cannot read other users profiles', async () => {
    // User A creates a profile
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    const formA = new FormData();
    formA.append('name', 'User A Profile');
    await saveProfile(formA);
    const profileA = (await getProfiles())[0]!;

    // User B tries to read
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_b');
    const profilesB = await getProfiles();
    expect(profilesB.length).toBe(0); // Cannot list

    const directAccess = await getProfile(profileA.id);
    expect(directAccess).toBeNull(); // Cannot get directly
  });

  it('enforces ownership isolation: users cannot update another users profile', async () => {
    // User A creates a profile
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    const formA = new FormData();
    formA.append('name', 'User A Profile');
    await saveProfile(formA);
    const profileA = (await getProfiles())[0]!;

    // User B tries to update it
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_b');
    const maliciousForm = new FormData();
    maliciousForm.append('id', profileA.id);
    maliciousForm.append('name', 'Hacked Name');
    
    await expect(saveProfile(maliciousForm)).rejects.toThrow('Unauthorized');

    // Verify it wasn't modified
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    const safeProfile = await getProfile(profileA.id);
    expect(safeProfile?.name).toBe('User A Profile');
  });

  it('enforces ownership isolation: users cannot delete another users profile', async () => {
    // User A creates
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    const formA = new FormData();
    formA.append('name', 'Safe Profile');
    await saveProfile(formA);
    const profileA = (await getProfiles())[0]!;

    // User B tries to delete
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_b');
    await expect(deleteProfile(profileA.id)).rejects.toThrow('Unauthorized');

    // Verify still exists
    vi.mocked(auth.getCurrentUserId).mockResolvedValue('user_a');
    const profiles = await getProfiles();
    expect(profiles.length).toBe(1);
  });
});
