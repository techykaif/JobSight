import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { runMission } from '../lib/pipeline/orchestrator.js';
import { bootstrap } from '../lib/bootstrap.js';

async function main() {
  await bootstrap();
  console.log("Starting M8 Bounded Real Mission...");

  // 1. Create Profile
  const profileId = crypto.randomUUID();
  await db.insert(schema.profiles).values({
    id: profileId,
    name: "M8 Verification User",
    yearsOfProfessionalExperience: 5,
    targetRoles: ["Frontend Engineer"],
    skills: ["React", "TypeScript", "Next.js"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 2. Create Hunt Config
  const configId = crypto.randomUUID();
  // IMPORTANT: For ingestion.ts, it uses config.maxResults to limit AGY prompt. I need to make sure config has maxResults.
  // Wait, maxResults is not in schema.huntConfigs, but we can pass it via config or just cast it. 
  // Wait, I updated ingestion.ts: "Please find exactly up to ${config.maxResults || 3} jobs."
  // So it will find 3 by default. I'll just use the default.
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: ["Frontend Engineer"],
    alternativeRoles: ["UI Engineer"],
    salaryMinimum: 120000,
    remoteRequirement: "Remote",
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
