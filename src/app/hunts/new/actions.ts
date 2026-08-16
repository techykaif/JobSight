'use server'

import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import crypto from 'crypto';
import { redirect } from 'next/navigation';

export async function saveHuntConfig(formData: FormData) {
  const configId = crypto.randomUUID();
  
  const rawTargetRoles = formData.get('targetRoles')?.toString() || '';
  const targetRoles = rawTargetRoles.split(',').map(s => s.trim()).filter(Boolean);

  const rawAlternativeRoles = formData.get('alternativeRoles')?.toString() || '';
  const alternativeRoles = rawAlternativeRoles.split(',').map(s => s.trim()).filter(Boolean);
  
  const rawRequiredSkills = formData.get('requiredSkills')?.toString() || '';
  const requiredSkills = rawRequiredSkills.split(',').map(s => s.trim()).filter(Boolean);
  
  const minimumDesiredSalary = formData.get('minimumDesiredSalary') ? parseInt(formData.get('minimumDesiredSalary')!.toString(), 10) : null;
  const desiredSalaryCurrency = formData.get('desiredSalaryCurrency')?.toString() || 'INR';
  const desiredSalaryPeriod = formData.get('desiredSalaryPeriod')?.toString() || 'MONTH';
  const requireSalaryDisclosure = formData.get('requireSalaryDisclosure') === 'true';
  const remoteRequirement = formData.get('remoteRequirement')?.toString() || null;
  const searchScope = formData.get('searchScope')?.toString() || 'LOCAL_AND_GLOBAL';
  const candidateCountry = formData.get('candidateCountry')?.toString() || 'India';
  const maximumUsableResults = formData.get('maximumUsableResults') ? parseInt(formData.get('maximumUsableResults')!.toString(), 10) : 3;
  const profileIdInput = formData.get('profileId')?.toString() || null;
  const profileId = profileIdInput === 'none' ? null : profileIdInput;

  const data = {
    id: configId,
    targetRoles,
    alternativeRoles,
    requiredSkills,
    minimumDesiredSalary,
    desiredSalaryCurrency,
    desiredSalaryPeriod,
    requireSalaryDisclosure,
    remoteRequirement,
    searchScope,
    candidateCountry,
    maximumUsableResults,
    profileId,
    
    discoveryStrategy: formData.get('discoveryStrategy')?.toString() || 'strategy_stealth',
    discoveryGroups: formData.get('discoveryGroups')?.toString().split(',').map(s => s.trim()).filter(Boolean) || [],
    userUrls: formData.get('userUrls')?.toString().split('\n').map(s => s.trim()).filter(Boolean) || [],
    maximumProviders: formData.get('maximumProviders') ? parseInt(formData.get('maximumProviders')!.toString(), 10) : 10,
    maximumRuntime: formData.get('maximumRuntime') ? parseInt(formData.get('maximumRuntime')!.toString(), 10) : 120000,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let profileSnapshot = null;
  
  if (profileId) {
    const { getCurrentUserId } = await import('@/lib/auth');
    const userId = await getCurrentUserId();
    
    // Load and validate ownership
    const { eq, and } = await import('drizzle-orm');
    const profileRecords = await db.select()
      .from(schema.profiles)
      .where(and(eq(schema.profiles.id, profileId), eq(schema.profiles.userId, userId)))
      .limit(1);
      
    if (!profileRecords[0]) {
      throw new Error('Unauthorized or missing profile');
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
        employmentPreferences: profile.employmentPreferences
      }
    };
  }

  // Use a transaction to ensure atomicity
  const runId = crypto.randomUUID();
  
  await db.insert(schema.huntConfigs).values(data);
  
  await db.insert(schema.runs).values({
    id: runId,
    configId,
    status: 'CREATED',
    currentStage: 'PENDING_START',
    profileSnapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  redirect(`/hunts/${runId}`);
}
