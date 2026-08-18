'use server'

import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { missionManager } from '@/lib/pipeline/missionManager';

// Exported so page.tsx can type the useActionState state parameter
export type HuntFormState = { error: string } | null;

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const HuntConfigSchema = z.object({
  targetRoles: z
    .array(z.string().min(1))
    .min(1, { message: 'At least one target role is required' }),

  alternativeRoles: z.array(z.string()),
  requiredSkills: z.array(z.string()),

  candidateCountry: z.string().min(1, { message: 'Candidate country cannot be empty' }),

  searchScope: z.enum(['LOCAL', 'GLOBAL_REMOTE', 'LOCAL_AND_GLOBAL']),

  remoteRequirement: z.string().nullable(),

  minimumDesiredSalary: z.number().int().positive().nullable(),

  desiredSalaryCurrency: z.string().min(1),

  desiredSalaryPeriod: z.enum(['YEAR', 'MONTH', 'WEEK', 'DAY', 'HOUR']),

  requireSalaryDisclosure: z.boolean(),

  discoveryStrategy: z.string().min(1),

  discoveryGroups: z.array(z.string()),

  // Basic http/https prefix check — full SSRF validation happens in source-manager
  userUrls: z.array(
    z.string().refine(
      u => /^https?:\/\//i.test(u),
      { message: 'Each URL must start with http:// or https://' }
    )
  ),

  maximumProviders: z
    .number()
    .int('Max providers must be an integer')
    .min(1, 'Max providers must be at least 1')
    .max(100, 'Max providers cannot exceed 100'),

  maximumRuntime: z
    .number()
    .int('Max runtime must be an integer (milliseconds)')
    .min(5000, 'Max runtime must be at least 5 000ms (5 seconds)')
    .max(3_600_000, 'Max runtime cannot exceed 3 600 000ms (1 hour)'),

  maximumUsableResults: z
    .number()
    .int({ message: 'Result target must be an integer' })
    .min(1, { message: 'Result target must be at least 1' })
    .max(100, { message: 'Result target cannot exceed 100' }),
});

// ---------------------------------------------------------------------------
// Server Action — signature updated for useActionState compatibility
// prevState is required by React's useActionState contract; we don't use it.
// To support existing tests that pass formData as the first argument, we
// handle both (prevState, formData) and (formData).
// ---------------------------------------------------------------------------
export async function saveHuntConfig(
  arg1: HuntFormState | FormData,
  arg2?: FormData
): Promise<HuntFormState> {
  const formData = arg2 instanceof FormData || (arg2 && typeof (arg2 as any).get === 'function')
    ? arg2
    : (arg1 as FormData);

  // ── 1. Parse raw form data ──────────────────────────────────────────────
  const rawTargetRoles = formData.get('targetRoles')?.toString() || '';
  const targetRoles = rawTargetRoles.split(',').map(s => s.trim()).filter(Boolean);

  const rawAlternativeRoles = formData.get('alternativeRoles')?.toString() || '';
  const alternativeRoles = rawAlternativeRoles.split(',').map(s => s.trim()).filter(Boolean);

  const rawRequiredSkills = formData.get('requiredSkills')?.toString() || '';
  const requiredSkills = rawRequiredSkills.split(',').map(s => s.trim()).filter(Boolean);

  const rawMinSalary = formData.get('minimumDesiredSalary')?.toString();
  const minimumDesiredSalary = rawMinSalary && rawMinSalary.trim() !== ''
    ? parseInt(rawMinSalary, 10)
    : null;

  const rawMaxProviders = formData.get('maximumProviders')?.toString();
  const maximumProviders = rawMaxProviders ? parseInt(rawMaxProviders, 10) : 10;

  const rawMaxRuntime = formData.get('maximumRuntime')?.toString();
  const maximumRuntime = rawMaxRuntime ? parseInt(rawMaxRuntime, 10) : 120_000;

  const rawMaxResults = formData.get('maximumUsableResults')?.toString();
  const maximumUsableResults = rawMaxResults ? parseInt(rawMaxResults, 10) : 5;

  const rawUserUrls = formData.get('userUrls')?.toString() || '';
  const userUrls = rawUserUrls.split('\n').map(s => s.trim()).filter(Boolean);

  const parsed = {
    targetRoles,
    alternativeRoles,
    requiredSkills,
    candidateCountry: formData.get('candidateCountry')?.toString() || 'India',
    searchScope: (formData.get('searchScope')?.toString() || 'LOCAL_AND_GLOBAL') as any,
    remoteRequirement: formData.get('remoteRequirement')?.toString() || null,
    minimumDesiredSalary: Number.isNaN(minimumDesiredSalary as number) ? null : minimumDesiredSalary,
    desiredSalaryCurrency: formData.get('desiredSalaryCurrency')?.toString() || 'INR',
    desiredSalaryPeriod: (formData.get('desiredSalaryPeriod')?.toString() || 'YEAR') as any,
    requireSalaryDisclosure: formData.get('requireSalaryDisclosure') === 'true',
    discoveryStrategy: formData.get('discoveryStrategy')?.toString() || 'strategy_stealth',
    discoveryGroups: formData.get('discoveryGroups')?.toString().split(',').map(s => s.trim()).filter(Boolean) || [],
    userUrls,
    maximumProviders: Number.isNaN(maximumProviders) ? 10 : maximumProviders,
    maximumRuntime: Number.isNaN(maximumRuntime) ? 120_000 : maximumRuntime,
    maximumUsableResults: Number.isNaN(maximumUsableResults) ? 5 : maximumUsableResults,
  };

  // ── 2. Zod validation ───────────────────────────────────────────────────
  const validation = HuntConfigSchema.safeParse(parsed);
  if (!validation.success) {
    // Return the first issue message as the user-facing error
    const firstIssue = validation.error.issues[0];
    return { error: firstIssue?.message ?? 'Validation failed. Please check your inputs.' };
  }

  const data = validation.data;

  // ── 3. Profile resolution (optional) ────────────────────────────────────
  const profileIdInput = formData.get('profileId')?.toString() || null;
  const profileId = profileIdInput === 'none' || profileIdInput === '' ? null : profileIdInput;

  let profileSnapshot = null;

  if (profileId) {
    try {
      const { getCurrentUserId } = await import('@/lib/auth');
      const userId = await getCurrentUserId();

      const { eq, and } = await import('drizzle-orm');
      const profileRecords = await db.select()
        .from(schema.profiles)
        .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.userId, userId)))
        .limit(1);

      if (!profileRecords[0]) {
        return { error: 'Selected profile not found or does not belong to your account.' };
      }

      const profile = profileRecords[0];
      profileSnapshot = {
        profileId: profile.id,
        profileName: profile.name,
        snapshotAt: new Date().toISOString(),
        profile: {
          yearsOfProfessionalExperience: profile.yearsOfProfessionalExperience,
          education: profile.education,
          targetRoles: profile.targetRoles,
          skills: profile.skills,
          projectExperience: profile.projectExperience,
          preferredRoles: profile.preferredRoles,
          salaryExpectations: profile.salaryExpectations,
          remotePreference: profile.remotePreference,
          allowedRegions: profile.allowedRegions,
          employmentPreferences: profile.employmentPreferences,
        },
      };
    } catch (e: any) {
      return { error: `Profile load failed: ${e.message}` };
    }
  }

  // ── 4. Persist ──────────────────────────────────────────────────────────
  const configId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db.insert(schema.huntConfigs).values({
      id: configId,
      targetRoles: data.targetRoles,
      alternativeRoles: data.alternativeRoles,
      requiredSkills: data.requiredSkills,
      minimumDesiredSalary: data.minimumDesiredSalary,
      desiredSalaryCurrency: data.desiredSalaryCurrency,
      desiredSalaryPeriod: data.desiredSalaryPeriod,
      requireSalaryDisclosure: data.requireSalaryDisclosure,
      remoteRequirement: data.remoteRequirement,
      searchScope: data.searchScope,
      candidateCountry: data.candidateCountry,
      maximumUsableResults: data.maximumUsableResults,
      profileId,
      discoveryStrategy: data.discoveryStrategy,
      discoveryGroups: data.discoveryGroups,
      userUrls: data.userUrls,
      maximumProviders: data.maximumProviders,
      maximumRuntime: data.maximumRuntime,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.runs).values({
      id: runId,
      configId,
      status: 'CREATED',
      currentStage: 'PENDING_START',
      profileSnapshot,
      createdAt: now,
      updatedAt: now,
    });
    
    // Automatically start the mission to avoid second click
    missionManager.start(runId).catch(err => {
      console.error('Failed to auto-start mission:', err);
    });
  } catch (e: any) {
    return { error: `Failed to save hunt configuration: ${e.message}` };
  }

  // redirect() throws NEXT_REDIRECT — caught by Next.js, not treated as error
  redirect(`/hunts/${runId}`);
}
