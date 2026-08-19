import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { runMission } from '../lib/pipeline/orchestrator.js';
import { bootstrap } from '../lib/bootstrap.js';

async function main() {
  await bootstrap();
  console.log("Starting Real Mission...");

  const profileId = crypto.randomUUID();
  await db.insert(schema.profiles).values({
    id: profileId,
    userId: 'system_test',
    name: "M8 Verification User",
    yearsOfProfessionalExperience: 5,
    targetRoles: ["Software Engineer"],
    skills: ["React", "TypeScript"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const configId = crypto.randomUUID();
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: ["Software Engineer"],
    alternativeRoles: [],
    salaryMinimum: 100000,
    remoteRequirement: "REMOTE_ONLY",
    candidateCountry: "India",
    requireSalaryDisclosure: false,
    discoveryStrategy: "strategy_stealth",
    maximumProviders: 10,
    maximumRuntime: 600000,
    maximumUsableResults: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });


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
