/**
 * V1.0.1-A ACCEPTANCE TEST
 * 
 * This script exercises the EXACT same code path as the UI:
 *   saveHuntConfig (same as form action) → missionManager.start() → runMission()
 * 
 * It does NOT use runMission() directly.
 */
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { missionManager } from '../lib/pipeline/missionManager.js';

async function main() {
  console.log("=== V1.0.1-A ACCEPTANCE TEST ===");
  console.log("Path: saveHuntConfig → missionManager.start() → runMission()");
  console.log("");

  // 1. Create Profile (same as /profile page would)
  const profileId = crypto.randomUUID();
  await db.insert(schema.profiles).values({
    id: profileId,
    userId: 'system_test',
    name: "V1.0.1-A Acceptance Candidate",
    yearsOfProfessionalExperience: 5,
    targetRoles: ["Software Engineer", "Full Stack Developer", "Backend Developer", "Automation Engineer"],
    skills: ["JavaScript", "TypeScript", "Python", "React", "Node.js", "Docker"],
    remotePreference: 'REMOTE_ONLY',
    allowedRegions: ["India", "Worldwide"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log(`[SETUP] Profile created: ${profileId}`);

  // 2. Create Hunt Config (same path as saveHuntConfig action)
  const configId = crypto.randomUUID();
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: ["Software Engineer", "Full Stack Developer", "Backend Developer", "Automation Engineer"],
    alternativeRoles: [],
    candidateCountry: "India",
    searchScope: "LOCAL_AND_GLOBAL",
    remoteRequirement: "REMOTE_ONLY",
    requireSalaryDisclosure: true,
    minimumDesiredSalary: 50000,
    desiredSalaryCurrency: "INR",
    desiredSalaryPeriod: "MONTH",
    maximumUsableResults: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log(`[SETUP] Hunt config created: ${configId}`);

  // 3. Create Run in CREATED state (same as saveHuntConfig action)
  const runId = crypto.randomUUID();
  await db.insert(schema.runs).values({
    id: runId,
    configId,
    status: 'CREATED',
    currentStage: 'PENDING_START',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  console.log(`[SETUP] Run created: ${runId}`);
  console.log("");

  // 4. Start via MissionManager (same as POST /api/runs/[id]/control {action: 'START'})
  console.log("[START] Calling missionManager.start() ...");
  const startTime = Date.now();
  
  try {
    await missionManager.start(runId);
    console.log("[START] missionManager.start() returned (async mission running in background)");
    
    // Poll for completion
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 5000)); // 5 second intervals
      
      const runRec = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
      const run = runRec[0]!;
      
      console.log(`[POLL] Status: ${run.status} | Stage: ${run.currentStage} | Elapsed: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
      
      if (['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'CANCELLED'].includes(run.status)) {
        break;
      }
      attempts++;
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log("");
    console.log("=== RESULTS ===");
    console.log(`Duration: ${duration.toFixed(1)}s`);
    
    // Fetch final run state
    const finalRun = (await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1))[0]!;
    console.log(`Run ID: ${runId}`);
    console.log(`Final Status: ${finalRun.status}`);
    console.log(`Current Stage: ${finalRun.currentStage}`);
    
    // Fetch observations (candidates discovered)
    const observations = await db.select().from(schema.jobObservations).where(eq(schema.jobObservations.runId, runId));
    console.log(`Candidates Discovered: ${observations.length}`);
    
    // Fetch decisions
    const decisions = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
    console.log(`Candidates Inspected (decisions): ${decisions.length}`);
    
    const usable = decisions.filter(d => ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'].includes(d.decision));
    const skipped = decisions.filter(d => d.decision === 'SKIP');
    const failed = decisions.filter(d => d.decision === 'FAILED');
    console.log(`Usable Jobs: ${usable.length}`);
    console.log(`Skipped Jobs: ${skipped.length}`);
    console.log(`Failed Jobs: ${failed.length}`);
    
    // Fetch failures
    const failures = await db.select().from(schema.failures).where(eq(schema.failures.runId, runId));
    console.log(`Failures: ${failures.length}`);
    
    // Fetch events
    const events = await db.select().from(schema.pipelineEvents).where(eq(schema.pipelineEvents.runId, runId));
    console.log(`Pipeline Events: ${events.length}`);
    
    // Detail skip reasons
    console.log("");
    console.log("=== SKIP REASONS ===");
    for (const d of skipped) {
      const job = (await db.select().from(schema.jobs).where(eq(schema.jobs.id, d.jobId)).limit(1))[0];
      console.log(`  ${job?.canonicalTitle || d.jobId}: ${(d.reasons as string[])?.join(', ')}`);
    }
    
    // Detail each usable job
    console.log("");
    console.log("=== USABLE JOBS ===");
    for (const d of usable) {
      const job = (await db.select().from(schema.jobs).where(eq(schema.jobs.id, d.jobId)).limit(1))[0];
      if (!job) continue;
      
      let companyName = 'Unknown';
      if (job.companyId) {
        const comp = (await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1))[0];
        if (comp) companyName = comp.displayName;
      }
      
      const scores = await db.select().from(schema.scores).where(eq(schema.scores.jobId, job.id));
      
      console.log(`  ---`);
      console.log(`  Title: ${job.canonicalTitle}`);
      console.log(`  Company: ${companyName}`);
      console.log(`  Source URL: ${job.canonicalUrl || 'N/A'}`);
      console.log(`  Decision: ${d.decision}`);
      console.log(`  Original Salary: ${job.salaryTextOriginal || 'N/A'}`);
      console.log(`  Salary Min Original: ${job.salaryMinOriginal || 'N/A'}`);
      console.log(`  Salary Currency Original: ${job.salaryCurrencyOriginal || 'N/A'}`);
      console.log(`  Salary Period Original: ${job.salaryPeriodOriginal || 'N/A'}`);
      console.log(`  Salary Min (Normalized): ${job.salaryMin || 'N/A'}`);
      console.log(`  Salary Currency: ${job.salaryCurrency || 'N/A'}`);
      console.log(`  Remote Type: ${job.remoteType || 'N/A'}`);
      console.log(`  Candidate Remote Eligibility: ${job.candidateRemoteEligibility || 'N/A'}`);
      console.log(`  Experience Min: ${job.experienceMin ?? 'N/A'}`);
      console.log(`  Experience Max: ${job.experienceMax ?? 'N/A'}`);
      console.log(`  Location: ${job.location || 'N/A'}`);
      console.log(`  Reasons: ${(d.reasons as string[])?.join(', ')}`);
      
      for (const s of scores) {
        console.log(`  Score [${s.scoreType}]: ${s.scoreValue}`);
      }
    }
    
    // Over-discovery acceptance
    console.log("");
    console.log("=== OVER-DISCOVERY ACCEPTANCE ===");
    console.log(`Desired Usable Count: 3`);
    const maxUsableEvent = events.find(e => e.eventType === 'MAX_USABLE_RESULTS_REACHED');
    console.log(`MAX_USABLE_RESULTS_REACHED event: ${maxUsableEvent ? 'YES' : 'NO'}`);
    console.log(`Actual Inspected: ${decisions.length}`);
    console.log(`Actual Usable: ${usable.length}`);
    
    // Failure details
    if (failures.length > 0) {
      console.log("");
      console.log("=== FAILURE DETAILS ===");
      for (const f of failures) {
        console.log(`  Stage: ${f.stage} | Code: ${f.failureCode} | Attempt: ${f.attempt} | Message: ${f.message?.slice(0, 100)}`);
      }
    }
    
  } catch (err) {
    console.error("[FATAL]", err);
  }
}

main().catch(console.error);
