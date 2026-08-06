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
    
    discoveryStrategy: formData.get('discoveryStrategy')?.toString() || 'strategy_stealth',
    discoveryGroups: formData.get('discoveryGroups')?.toString().split(',').map(s => s.trim()).filter(Boolean) || [],
    userUrls: formData.get('userUrls')?.toString().split('\n').map(s => s.trim()).filter(Boolean) || [],
    maximumProviders: formData.get('maximumProviders') ? parseInt(formData.get('maximumProviders')!.toString(), 10) : 10,
    maximumRuntime: formData.get('maximumRuntime') ? parseInt(formData.get('maximumRuntime')!.toString(), 10) : 120000,
    
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await db.insert(schema.huntConfigs).values(data);
  
  // Create a run in CREATED state as specified in M7 (Option A)
  const runId = crypto.randomUUID();
  await db.insert(schema.runs).values({
    id: runId,
    configId,
    status: 'CREATED',
    currentStage: 'PENDING_START',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  redirect(`/hunts/${runId}`);
}
