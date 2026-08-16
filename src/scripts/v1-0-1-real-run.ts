import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { runMission } from '../lib/pipeline/orchestrator.js';

async function main() {
  console.log("Starting V1.0.1-A Bounded Real Mission...");

  // 1. Create Profile
  const profileId = crypto.randomUUID();
  await db.insert(schema.profiles).values({
    id: profileId,
    userId: 'system_test',
    name: "V1.0.1 Verification User",
    yearsOfProfessionalExperience: 5,
    targetRoles: ["Frontend Engineer", "Full Stack Engineer"],
    skills: ["React", "TypeScript", "Next.js"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 2. Create Hunt Config
  const configId = crypto.randomUUID();
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: ["Frontend Engineer"],
    alternativeRoles: ["Full Stack Engineer"],
    candidateCountry: "India",
    searchScope: "GLOBAL_REMOTE",
    remoteRequirement: "REMOTE_ONLY",
    requireSalaryDisclosure: true,
    minimumDesiredSalary: 2500000,
    desiredSalaryCurrency: "INR",
    desiredSalaryPeriod: "YEAR",
    maximumUsableResults: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 3. Create Run
  const runId = crypto.randomUUID();
  await db.insert(schema.runs).values({
    id: runId,
    configId: configId,
    status: 'CREATED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log(`Created Run: ${runId}`);
  const startTime = Date.now();

  const abortController = new AbortController();
  
  try {
    await runMission(runId, abortController.signal, () => false);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`Mission finished in ${duration}s`);

    // Fetch results
    const decisions = await db.select().from(schema.decisions).where(
      eq(schema.decisions.runId, runId)
    );
    
    console.log(`Decisions made: ${decisions.length}`);
    for (const d of decisions) {
      console.log(` - Job ${d.jobId}: ${d.decision}`);
    }

  } catch (err) {
    console.error("Mission failed:", err);
  }
}

main().catch(console.error);
