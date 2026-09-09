import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { runMission } from '../lib/pipeline/orchestrator.js';
import { bootstrap } from '../lib/bootstrap.js';
import fs from 'fs';

const experimentId = `phase13-${Date.now()}`;
const manifestPath = `experiment-manifest-${experimentId}.json`;

const hunts = [
  { name: 'HUNT 01 - FRESHER SOFTWARE ENGINEER', roles: ['Junior Software Engineer', 'Entry Level Software Engineer'], strategy: 'strategy_default' },
  { name: 'HUNT 02 - REMOTE FULLSTACK', roles: ['Full Stack Engineer', 'Full Stack Developer'], strategy: 'strategy_default' },
  { name: 'HUNT 03 - REMOTE FRONTEND', roles: ['Frontend Engineer', 'Frontend Developer'], strategy: 'strategy_default' },
  { name: 'HUNT 04 - REMOTE BACKEND', roles: ['Backend Engineer', 'Software Engineer'], strategy: 'strategy_default' },
  { name: 'HUNT 05 - STARTUP ENGINEERING', roles: ['Software Engineer'], strategy: 'strategy_startup' },
  { name: 'HUNT 06 - SMALL / MID-SIZE EMPLOYER', roles: ['Software Engineer', 'Developer'], strategy: 'strategy_startup' },
  { name: 'HUNT 07 - ATS DIVERSITY', roles: ['Software Engineer'], strategy: 'strategy_default' },
  { name: 'HUNT 08 - EARLY-STAGE COMPANY', roles: ['Software Engineer', 'Full Stack Engineer'], strategy: 'strategy_stealth' },
  { name: 'HUNT 09 - REMOTE WEB ENGINEERING', roles: ['Web Engineer', 'Frontend Engineer'], strategy: 'strategy_default' },
  { name: 'HUNT 10 - BROAD SOFTWARE ENGINEERING', roles: ['Software Engineer'], strategy: 'strategy_default' }
];

async function runSingleHunt(huntConfig: typeof hunts[0]): Promise<string> {
  console.log(`\n=== Starting ${huntConfig.name} ===`);
  const profileId = crypto.randomUUID();
  await db.insert(schema.profiles).values({
    id: profileId,
    userId: 'experiment_test',
    name: "Fresher Candidate India",
    yearsOfProfessionalExperience: 0,
    targetRoles: huntConfig.roles,
    skills: ["React", "TypeScript", "Node", "JavaScript", "Python", "SQL"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const configId = crypto.randomUUID();
  await db.insert(schema.huntConfigs).values({
    id: configId,
    targetRoles: huntConfig.roles,
    alternativeRoles: [],
    salaryMinimum: 0,
    remoteRequirement: "REMOTE_ONLY",
    candidateCountry: "India",
    requireSalaryDisclosure: false,
    discoveryStrategy: huntConfig.strategy,
    maximumProviders: 3, 
    maximumRuntime: 120000,
    maximumUsableResults: 5,
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

  return runId;
}

async function executeRun(runId: string) {
  const abortController = new AbortController();
  try {
    await runMission(runId, abortController.signal, () => false);
  } catch (err) {
    console.error(`Run ${runId} failed at orchestrator level:`, err);
  }
}

async function main() {
  await bootstrap();
  console.log(`Creating experiment: ${experimentId}`);
  
  const manifest = {
    experimentId,
    requestedRuns: hunts.length,
    launchedRuns: 0,
    runs: [] as any[]
  };

  const runIds = [];
  for (const h of hunts) {
    const runId = await runSingleHunt(h);
    runIds.push(runId);
    manifest.runs.push({
      runId,
      hunt: h.name,
      status: 'CREATED'
    });
  }
  manifest.launchedRuns = runIds.length;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("Running hunts with safe concurrency limit: 2");
  for (let i = 0; i < runIds.length; i += 2) {
    const batch = runIds.slice(i, i + 2);
    await Promise.all(batch.map(id => executeRun(id)));
  }

  const finalRuns = await db.select({ id: schema.runs.id, status: schema.runs.status }).from(schema.runs).where(inArray(schema.runs.id, runIds));
  const runStatusMap = new Map(finalRuns.map(r => [r.id, r.status]));
  
  let terminal = 0;
  let running = 0;
  let failed = 0;
  let completed = 0;
  let completedWithFailures = 0;

  for (const r of manifest.runs) {
    const status = runStatusMap.get(r.runId) || 'UNKNOWN';
    r.status = status;
    
    if (['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'CANCELLED'].includes(status)) {
      terminal++;
      if (status === 'COMPLETED') completed++;
      if (status === 'COMPLETED_WITH_FAILURES') completedWithFailures++;
      if (status === 'FAILED') failed++;
    } else {
      running++;
    }
  }

  (manifest as any)['summary'] = { terminal, running, failed, completed, completedWithFailures };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log("\n=== EXPERIMENT EXECUTION COMPLETE ===");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch(console.error).then(() => process.exit(0));
