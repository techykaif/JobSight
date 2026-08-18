import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import * as schema from '../lib/db/schema';
import crypto from 'crypto';
import { runMission } from '../lib/pipeline/orchestrator';
import { bootstrap } from '../lib/bootstrap';

async function main() {
  bootstrap(); // Important to initialize providers

  const profileId = crypto.randomUUID();
  const configId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create a minimal profile
  await db.insert(schema.profiles).values({
    id: profileId,
    name: 'Validation Profile',
    yearsOfProfessionalExperience: 5,
    targetRoles: ['Software Engineer'] as any,
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'] as any,
    createdAt: now,
    updatedAt: now,
  });

  // Create the config
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: ['Software Engineer'],
    alternativeRoles: ['Software Developer', 'Full Stack Developer', 'Backend Engineer', 'Frontend Engineer', 'React Developer', 'Node.js Developer', 'TypeScript Developer'],
    requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'REST APIs', 'PostgreSQL', 'SQL', 'Git', 'GitHub', 'AWS'],
    minimumDesiredSalary: 0,
    desiredSalaryCurrency: 'USD',
    desiredSalaryPeriod: 'YEARLY',
    requireSalaryDisclosure: false,
    remoteRequirement: 'REMOTE_ONLY',
    searchScope: 'GLOBAL_REMOTE',
    candidateCountry: 'India',
    maximumUsableResults: 10,
    profileId,
    discoveryStrategy: 'strategy_stealth',
    discoveryGroups: ['ATS_ONLY'],
    maximumProviders: 5,
    maximumRuntime: 120000,
    createdAt: now,
    updatedAt: now,
  });

  const profileRows = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).limit(1);
  const profileRow = profileRows[0];
  if (!profileRow) throw new Error('Profile not found');

  // Create the run
  await db.insert(schema.runs).values({
    id: runId,
    configId,
    status: 'CREATED',
    currentStage: 'PENDING_START',
    profileSnapshot: { profileName: profileRow.name, profileId: profileRow.id, profile: profileRow },
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Starting Validation Hunt Run: ${runId}`);
  
  const ac = new AbortController();
  try {
    await runMission(runId, ac.signal, () => false);
    console.log(`Mission Completed. Run ID: ${runId}`);
  } catch (e) {
    console.error(`Mission Failed`, e);
  }
}

main().catch(console.error);
