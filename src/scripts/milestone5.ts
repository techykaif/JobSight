import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { M5CandidateFixture } from '../fixtures/candidate-profile.js';
import { qualificationTestCases } from '../fixtures/qualification-cases.js';
import { qualifyJob } from '../lib/qualification/engine.js';
import { M4HuntFixture } from '../fixtures/m4-hunt.js';
import crypto from 'crypto';
import * as repos from '../lib/db/repositories/index.js';

async function runMilestone5() {
  console.log('\\n──────────────\\nJOBSight Qualification\\n──────────────\\n');

  let stats = { evaluated: 0, apply: 0, consider: 0, skip: 0 };
  const huntConfig = M4HuntFixture;

  // 1. Run controlled fixtures
  console.log('--- CONTROLLED FIXTURES ---');
  for (const tc of qualificationTestCases) {
    const result = await qualifyJob(tc.job, huntConfig, M5CandidateFixture);
    printResult(tc.name, tc.job.title, result);
    updateStats(stats, result.decision);
  }

  // 2. Run on real jobs from DB
  console.log('\\n--- REAL DB JOBS ---');
  const realJobs = await db.select().from(schema.jobs);
  
  if (realJobs.length === 0) {
    console.log('No real jobs found in the database. Run milestone 4 first if you want real jobs evaluated.');
  }

  // To save on AGY calls for the real jobs, we process them sequentially
  for (const job of realJobs) {
    // Reconstruct the job structure as expected by qualifyJob
    const jobData = {
      title: job.canonicalTitle || job.normalizedTitle,
      remoteType: job.remoteType,
      status: job.status,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      experienceMin: job.experienceMin,
      experienceMax: job.experienceMax,
      location: job.location,
      description: (() => {
        try {
          return job.description ? JSON.parse(job.description) : {};
        } catch (e) {
          return { summary: job.description };
        }
      })()
    };

    const companyName = job.companyId ? 'Company' : 'Unknown';
    const result = await qualifyJob(jobData, huntConfig, M5CandidateFixture);
    printResult(`DB Job: ${companyName}`, jobData.title || 'Unknown', result);
    updateStats(stats, result.decision);
    
    // Store analysis if available
    if (result.analysis) {
        try {
            await db.insert(schema.jobAnalysis).values({
                id: crypto.randomUUID(),
                jobId: job.id,
                runId: null, // Assuming no specific run for standalone qualification
                experienceFlexibility: result.analysis.experienceStrictness,
                seniorityAssessment: result.analysis.actualSeniority,
                requirementDifficulty: result.analysis.responsibilityComplexity,
                competitionEstimate: null,
                analysisReasoning: JSON.stringify(result.analysis.reasoning),
                analysisTimestamp: new Date().toISOString(),
                workerMetadata: JSON.stringify({ version: 'opportunity_v1' })
            }).onConflictDoNothing();
        } catch(e) {
            console.error('Failed to save analysis for', job.id);
        }
    }
    
    // Store scores
    const scoreIdBase = crypto.randomUUID().substring(0, 8);
    await db.insert(schema.scores).values([
      { id: `${scoreIdBase}-res`, jobId: job.id, scoreType: 'RESUME_MATCH', scoreValue: result.scores.resumeMatch, scoringVersion: 'opportunity_v1', createdAt: new Date().toISOString() },
      { id: `${scoreIdBase}-req`, jobId: job.id, scoreType: 'REQUIREMENT_MATCH', scoreValue: result.scores.requirementMatch, scoringVersion: 'opportunity_v1', createdAt: new Date().toISOString() },
      { id: `${scoreIdBase}-opp`, jobId: job.id, scoreType: 'OPPORTUNITY', scoreValue: result.scores.opportunity, scoringVersion: 'opportunity_v1', createdAt: new Date().toISOString() }
    ]).onConflictDoNothing();

    // Store decisions
    await db.insert(schema.decisions).values({
      id: crypto.randomUUID(),
      jobId: job.id,
      runId: null,
      decision: result.decision,
      reasons: JSON.stringify(result.reasons),
      unknowns: JSON.stringify(result.unknowns),
      createdAt: new Date().toISOString()
    }).onConflictDoNothing();
  }

  console.log('\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\nSUMMARY\\n');
  console.log(`Evaluated:   ${stats.evaluated}`);
  console.log(`Apply:       ${stats.apply}`);
  console.log(`Consider:    ${stats.consider}`);
  console.log(`Skip:        ${stats.skip}`);
  console.log('\\n');
}

function printResult(name: string, title: string, result: any) {
  console.log(`\\n${name}\\n   ${title}\\n`);
  
  if (result.decision === 'SKIP') {
    console.log(`   Decision: SKIP`);
    console.log(`   Hard filter reasons:\\n     ${result.reasons.join('\\n     ')}`);
  } else {
    console.log(`   Resume Match       ${result.scores.resumeMatch}`);
    console.log(`   Requirement Match  ${result.scores.requirementMatch}`);
    console.log(`   Opportunity        ${result.scores.opportunity}`);
    console.log(`   Confidence         ${result.scores.confidence}`);
    console.log(`\\n   Decision: ${result.decision}\\n`);
    console.log(`   Reasons:\\n     * ${result.reasons.join('\\n     * ')}`);
  }
}

function updateStats(stats: any, decision: string) {
  stats.evaluated++;
  if (decision === 'APPLY') stats.apply++;
  else if (decision === 'CONSIDER' || decision === 'RESEARCH_REQUIRED') stats.consider++;
  else stats.skip++;
}

runMilestone5().catch(console.error);
