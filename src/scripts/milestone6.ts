import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { getCompanyIntelligence } from '../lib/company/engine.js';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';

async function runMilestone6() {
  console.log('\\n──────────────\\nJOBSight — Company Intelligence\\n──────────────\\n');

  // Find jobs that survived M5 initial qualification
  const qualifiedDecisions = await db.select()
    .from(schema.decisions)
    .where(inArray(schema.decisions.decision, ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED']));

  if (qualifiedDecisions.length === 0) {
    console.log('No qualified jobs found. Please ensure M5 (qualification) produced viable candidates.');
    return;
  }

  const jobIds = qualifiedDecisions.map(d => d.jobId);
  const jobs = await db.select().from(schema.jobs).where(inArray(schema.jobs.id, jobIds));

  // For testing milestone 6 quickly, let's limit to 1 real company if there are many.
  // The prompt said: "Use at least one company attached to the real M4 jobs."
  const jobsToProcess = jobs.slice(0, 1);

  for (const job of jobsToProcess) {
    const decisionRec = qualifiedDecisions.find(d => d.jobId === job.id);
    if (!decisionRec) continue;
    
    // Get M5 scores
    const scoreRecs = await db.select().from(schema.scores).where(eq(schema.scores.jobId, job.id));
    const oppV1Rec = scoreRecs.find(s => s.scoreType === 'OPPORTUNITY');
    const oppV1 = oppV1Rec && oppV1Rec.scoreValue !== null ? oppV1Rec.scoreValue : 50;

    const resumeRec = scoreRecs.find(s => s.scoreType === 'RESUME_MATCH');
    const reqRec = scoreRecs.find(s => s.scoreType === 'REQUIREMENT_MATCH');
    
    // Check if company exists
    let companyName = 'Unknown Company';
    if (job.companyId) {
      const companyRec = await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1);
      const displayName = companyRec[0]?.displayName;
      if (displayName) {
        companyName = displayName;
      }
    } else {
      // Try to extract from job snippet or skip
      console.log(`Job ${job.canonicalTitle} has no associated company. Skipping.`);
      continue;
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`);
    console.log(`${companyName}`);
    console.log(`Role: ${job.canonicalTitle || job.normalizedTitle}\\n`);
    
    console.log(`Qualification`);
    console.log(`Resume Match:       ${resumeRec && resumeRec.scoreValue !== null ? resumeRec.scoreValue : 'N/A'}`);
    console.log(`Requirement Match:  ${reqRec && reqRec.scoreValue !== null ? reqRec.scoreValue : 'N/A'}`);
    console.log(`Opportunity V1:     ${oppV1}\\n`);

    const intelligence = await getCompanyIntelligence(
      job, 
      companyName, 
      oppV1, 
      decisionRec.decision, 
      false // Force refresh false to use cache
    );

    console.log(`Company Intelligence`);
    console.log(`Company Score:      ${intelligence.scores.companyScore}`);
    console.log(`Hiring Momentum:    ${intelligence.scores.hiringMomentum}`);
    console.log(`Confidence:         ${intelligence.scores.confidence}\\n`);
    
    console.log(`Observed:`);
    if (intelligence.research) {
       const res = intelligence.research;
       if (res.hiring.currentOpenings) console.log(`* ${res.hiring.currentOpenings} current openings`);
       if (res.hiring.engineeringOpenings) console.log(`* ${res.hiring.engineeringOpenings} engineering openings`);
       if (res.hiring.remoteOpenings) console.log(`* ${res.hiring.remoteOpenings} remote roles`);
       res.signals.expansionSignals.forEach(s => console.log(`* (Expansion) ${s.description}`));
       res.signals.stabilitySignals.forEach(s => console.log(`* (Stability) ${s.description}`));
       
       console.log(`\\nConcerns:`);
       res.signals.contractionSignals.forEach(s => console.log(`* (Contraction) ${s.description}`));
       res.layoffs?.recentLayoffEvidence.forEach(s => console.log(`* (Layoff) ${s.description}`));
       
       console.log(`\\nSources: ${res.sources.length}`);
    } else {
       console.log(`* No detailed research recovered.`);
    }

    console.log(`\\nOpportunity V2:     ${intelligence.scores.opportunityV2}`);
    console.log(`Priority:           ${intelligence.decision}\\n`);
    
    // Persist M6 scores
    const scoreIdBase = crypto.randomUUID().substring(0, 8);
    await db.insert(schema.scores).values([
      { id: `${scoreIdBase}-comp`, jobId: job.id, scoreType: 'COMPANY_SCORE', scoreValue: intelligence.scores.companyScore, scoringVersion: 'company_v1', createdAt: new Date().toISOString() },
      { id: `${scoreIdBase}-mom`, jobId: job.id, scoreType: 'HIRING_MOMENTUM', scoreValue: intelligence.scores.hiringMomentum, scoringVersion: 'hiring_momentum_v1', createdAt: new Date().toISOString() },
      { id: `${scoreIdBase}-opp2`, jobId: job.id, scoreType: 'OPPORTUNITY_V2', scoreValue: intelligence.scores.opportunityV2, scoringVersion: 'opportunity_v2', createdAt: new Date().toISOString() }
    ]).onConflictDoNothing();
    
    // We update the decisions table with the latest decision
    await db.update(schema.decisions).set({
      decision: intelligence.decision
    }).where(eq(schema.decisions.jobId, job.id));

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n`);
  }
}

runMilestone6().catch(console.error);
