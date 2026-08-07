import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, isNull, inArray } from 'drizzle-orm';
import { emitEvent } from './events';
import { runIngestionPipeline } from './ingestion';
import { qualifyJob } from '../qualification/engine';
import { getCompanyIntelligence } from '../company/engine';
import { runIntelligenceFoundation, persistIntelligenceFoundation } from '../intelligence-foundation/index.js';
import { runCompetitionIntelligence, persistCompetitionIntelligence } from '../competition/index.js';
import { runCompanyOpportunityIntelligence, persistCompanyOpportunityIntelligence } from '../company-opportunity/index.js';
import { CandidateProfileSchema, type CandidateProfile } from '../qualification/schema';
import crypto from 'crypto';

export async function runMission(runId: string, abortSignal: AbortSignal, isPauseRequested: () => boolean) {
  let config: any;
  let profile: any;

  const updateState = async (status: string, stage: string) => {
    await db.update(schema.runs).set({ status, currentStage: stage, updatedAt: new Date().toISOString() }).where(eq(schema.runs.id, runId));
  };

  const checkPauseOrCancel = async () => {
    if (abortSignal.aborted) {
      await updateState('CANCELLED', 'ABORTED');
      await emitEvent({ runId, type: 'RUN_CANCELLED', stage: 'ABORTED', message: 'Mission was cancelled.' });
      throw new Error('Mission Cancelled');
    }
    if (isPauseRequested()) {
      await updateState('PAUSED', 'PAUSED');
      await emitEvent({ runId, type: 'RUN_PAUSED', stage: 'PAUSED', message: 'Mission paused.' });
      
      // We block here checking periodically if we are unpaused or aborted.
      // This is a cooperative pause loop.
      while (isPauseRequested() && !abortSignal.aborted) {
        await new Promise(r => setTimeout(r, 1000));
      }
      if (abortSignal.aborted) {
        await updateState('CANCELLED', 'ABORTED');
        await emitEvent({ runId, type: 'RUN_CANCELLED', stage: 'ABORTED', message: 'Mission was cancelled.' });
        throw new Error('Mission Cancelled');
      }
      
      await updateState('RUNNING', 'RESUMED');
      await emitEvent({ runId, type: 'RUN_RESUMED', stage: 'RESUMED', message: 'Mission resumed.' });
    }
  };

  try {
    const runRec = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1);
    if (!runRec[0]) throw new Error('Run not found');
    const run = runRec[0];
    
    // Determine start stage based on checkpoint
    const lastCp = run.lastCheckpoint;
    const skipPreflight = ['PREFLIGHT_COMPLETED', 'DISCOVERY_COMPLETED', 'QUALIFICATION_COMPLETED', 'COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');
    const skipDiscovery = ['DISCOVERY_COMPLETED', 'QUALIFICATION_COMPLETED', 'COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');
    const skipQualification = ['QUALIFICATION_COMPLETED', 'COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');
    const skipCompanyResearch = ['COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');
    const skipFoundation = ['FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');
    const skipCompetition = ['COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');
    const skipCompanyOpportunity = ['COMPANY_OPPORTUNITY_COMPLETED'].includes(lastCp || '');

    if (lastCp) {
      await emitEvent({ runId, type: 'RUN_RESUMED_FROM_CHECKPOINT', stage: 'START', message: `Resuming run from checkpoint: ${lastCp}` });
    } else {
      await emitEvent({ runId, type: 'RUN_STARTED', stage: 'START', message: 'Initializing mission.' });
    }

    const configRec = await db.select().from(schema.huntConfigs).where(eq(schema.huntConfigs.id, run.configId)).limit(1);
    if (!configRec[0]) throw new Error('Hunt config not found');
    config = configRec[0];

    if (!run.profileSnapshot) {
      const profileRec = await db.select().from(schema.profiles).limit(1);
      if (!profileRec[0]) throw new Error('Candidate profile not found');
      profile = profileRec[0];
      await db.update(schema.runs).set({ profileSnapshot: profile, startedAt: new Date().toISOString() }).where(eq(schema.runs.id, runId));
    } else {
      profile = run.profileSnapshot;
    }
    
    let validProfile: CandidateProfile;
    try {
      validProfile = CandidateProfileSchema.parse(profile);
    } catch (e: any) {
      throw new Error(`Profile validation failed: ${e.message}`);
    }

    // PREFLIGHT
    if (!skipPreflight) {
      await updateState('RUNNING', 'PREFLIGHT');
      await emitEvent({ runId, type: 'PREFLIGHT_STARTED', stage: 'PREFLIGHT' });

      const { execa } = await import('execa');
      try {
        await execa('agy', ['--version'], { timeout: 5000 });
      } catch {
        throw new Error('AGY CLI is not available. Please ensure it is installed and in PATH.');
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'PREFLIGHT_COMPLETED' }).where(eq(schema.runs.id, runId));
      await emitEvent({ runId, type: 'PREFLIGHT_COMPLETED', stage: 'PREFLIGHT' });
    }
    
    await checkPauseOrCancel();

    // DISCOVERY & INGESTION
    if (!skipDiscovery) {
      await updateState('RUNNING', 'DISCOVERY');
      await emitEvent({ runId, type: 'DISCOVERY_STARTED', stage: 'DISCOVERY', message: 'Starting job discovery' });

      const ingestionResult = await runIngestionPipeline(runId, config, abortSignal);
      
      await db.update(schema.runs).set({ lastCheckpoint: 'DISCOVERY_COMPLETED' }).where(eq(schema.runs.id, runId));
      await emitEvent({ 
        runId, 
        type: 'DISCOVERY_BATCH_COMPLETED', 
        stage: 'DISCOVERY',
        payload: ingestionResult,
        message: `Discovery complete. Found ${ingestionResult.discovered}, valid ${ingestionResult.valid}`
      });
    }

    await checkPauseOrCancel();

    // QUALIFICATION
    if (!skipQualification) {
      await updateState('RUNNING', 'QUALIFICATION');
      await emitEvent({ runId, type: 'QUALIFICATION_STARTED', stage: 'QUALIFY' });

      const runJobs = await db.select({ job: schema.jobs }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .where(eq(schema.jobObservations.runId, runId));

      const runFailures = await db.select().from(schema.failures).where(eq(schema.failures.runId, runId));

      const jobsToQualify = [];
      for (const { job } of runJobs) {
        const existingDec = await db.select().from(schema.decisions).where(eq(schema.decisions.jobId, job.id)).limit(1);
        const qualifyFailures = runFailures.filter(f => f.stage === 'QUALIFY' && f.entityId === job.id);
        const exhausted = qualifyFailures.length >= 2; // max 2 cross-run retries
        
        if (existingDec.length === 0 && !exhausted) {
          jobsToQualify.push({ job, attempts: qualifyFailures.length });
        }
      }

      const maxUsable = config.maximumUsableResults || 3;
      let usableCount = 0;

      for (const { job, attempts } of jobsToQualify) {
        if (usableCount >= maxUsable) {
          // Bounded over-discovery limit reached
          await emitEvent({
            runId, type: 'MAX_USABLE_RESULTS_REACHED', stage: 'QUALIFY', entityType: 'RUN', entityId: runId,
            message: `Reached target of ${maxUsable} usable results. Skipping remaining candidates.`
          });
          break;
        }

        await checkPauseOrCancel();
        try {
          const qResult = await qualifyJob(job, config, validProfile, abortSignal);
          
          await db.insert(schema.decisions).values({
            id: crypto.randomUUID(),
            runId,
            jobId: job.id,
            decision: qResult.decision,
            reasons: qResult.reasons,
            unknowns: qResult.unknowns,
            createdAt: new Date().toISOString()
          });

          const scoreTypes = [
            { type: 'RESUME_MATCH', val: qResult.scores.resumeMatch },
            { type: 'REQUIREMENT_MATCH', val: qResult.scores.requirementMatch },
            { type: 'OPPORTUNITY', val: qResult.scores.opportunity }
          ];

          for (const s of scoreTypes) {
            if (s.val !== null && s.val !== undefined) {
              await db.insert(schema.scores).values({
                id: crypto.randomUUID(),
                runId,
                jobId: job.id,
                scoreType: s.type,
                scoreValue: s.val,
                scoringVersion: 'V1',
                createdAt: new Date().toISOString()
              });
            }
          }

          await emitEvent({
            runId,
            type: 'QUALIFICATION_COMPLETED',
            stage: 'QUALIFY',
            entityType: 'JOB',
            entityId: job.id,
            payload: { decision: qResult.decision },
            message: `Qualified job ${job.canonicalTitle}: ${qResult.decision}`
          });

          if (['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'].includes(qResult.decision)) {
            usableCount++;
          }

        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          
          const newAttemptCount = attempts + 1;
          const retryable = true;

          await db.insert(schema.failures).values({
            id: crypto.randomUUID(),
            runId,
            stage: 'QUALIFY',
            entityType: 'JOB',
            entityId: job.id,
            failureCode: err.code || 'UNKNOWN',
            message: err.message,
            attempt: newAttemptCount,
            retryable,
            createdAt: new Date().toISOString()
          });

          if (newAttemptCount >= 2) {
            await emitEvent({ runId, type: 'RETRY_EXHAUSTED', stage: 'QUALIFY', entityType: 'JOB', entityId: job.id, message: `Retry exhausted for qualification: ${job.canonicalTitle} - ${err.message}` });
            
            await db.insert(schema.decisions).values({
              id: crypto.randomUUID(),
              runId,
              jobId: job.id,
              decision: 'FAILED',
              reasons: [`Qualification failed permanently: ${err.message}`],
              unknowns: [],
              createdAt: new Date().toISOString()
            });
            await emitEvent({
              runId, type: 'QUALIFICATION_FAILED', stage: 'QUALIFY', entityType: 'JOB', entityId: job.id,
              message: `Qualification failed completely: ${job.canonicalTitle} - ${err.message}`
            });
          } else {
            await emitEvent({
              runId, type: 'QUALIFICATION_FAILED', stage: 'QUALIFY', entityType: 'JOB', entityId: job.id,
              message: `Qualification failed (attempt ${newAttemptCount}): ${job.canonicalTitle} - ${err.message}`
            });
          }
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'QUALIFICATION_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

    await checkPauseOrCancel();

    // COMPANY RESEARCH
    if (!skipCompanyResearch) {
      const activeDecisions = await db.select().from(schema.decisions)
        .where(inArray(schema.decisions.decision, ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED']));
      
      const runJobs = await db.select({ job: schema.jobs }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .where(eq(schema.jobObservations.runId, runId));

      const runFailures = await db.select().from(schema.failures).where(eq(schema.failures.runId, runId));

      const runDecisions = activeDecisions.filter(d => runJobs.some(rj => rj.job.id === d.jobId));

      const companiesToResearch = [];
      for (const d of runDecisions) {
        const job = runJobs.find(rj => rj.job.id === d.jobId)?.job;
        if (!job || !job.companyId) continue;
        
        const existingScores = await db.select().from(schema.scores)
          .where(eq(schema.scores.jobId, job.id));
        if (existingScores.some(s => s.scoreType === 'COMPANY_SCORE' && s.runId === runId)) {
          continue; 
        }

        const compFailures = runFailures.filter(f => f.stage === 'COMPANY' && f.entityId === job.companyId);
        if (compFailures.length >= 2) continue; // Exhausted

        companiesToResearch.push({ d, job, existingScores, attempts: compFailures.length });
      }

      if (companiesToResearch.length === 0) {
        await emitEvent({ runId, type: 'COMPANY_RESEARCH_SKIPPED', stage: 'COMPANY', message: 'Skipped company research: NO_ELIGIBLE_JOBS' });
        await db.update(schema.runs).set({ lastCheckpoint: 'COMPANY_RESEARCH_COMPLETED' }).where(eq(schema.runs.id, runId));
      } else {
        await updateState('RUNNING', 'COMPANY_RESEARCH');
        await emitEvent({ runId, type: 'COMPANY_RESEARCH_STARTED', stage: 'COMPANY' });

      for (const { d, job, existingScores, attempts } of companiesToResearch) {
        await checkPauseOrCancel();
        
        const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId!)).limit(1);
        const company = compRec[0];
        if (!company) continue;

        const oppV1 = existingScores.find(s => s.scoreType === 'OPPORTUNITY')?.scoreValue || 50;

        try {
          const cResult = await getCompanyIntelligence(job, company.displayName, oppV1, d.decision, false, abortSignal);
          
          if (cResult.decision !== d.decision) {
            await db.update(schema.decisions).set({ decision: cResult.decision }).where(eq(schema.decisions.id, d.id));
          }

          const cScores = [
            { type: 'COMPANY_SCORE', val: cResult.scores.companyScore },
            { type: 'HIRING_MOMENTUM', val: cResult.scores.hiringMomentum },
            { type: 'OPPORTUNITY_V2', val: cResult.scores.opportunityV2 },
            { type: 'APPLICATION_PRIORITY', val: cResult.scores.applicationPriority }
          ];

          for (const s of cScores) {
            await db.insert(schema.scores).values({
              id: crypto.randomUUID(),
              runId,
              jobId: job.id,
              scoreType: s.type,
              scoreValue: s.val,
              scoringVersion: 'V2',
              createdAt: new Date().toISOString()
            });
          }

          await emitEvent({
            runId,
            type: 'COMPANY_RESEARCH_COMPLETED',
            stage: 'COMPANY',
            entityType: 'COMPANY',
            entityId: company.id,
            message: `Researched ${company.displayName}: ${cResult.decision}`
          });

        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;

          const newAttemptCount = attempts + 1;
          await db.insert(schema.failures).values({
            id: crypto.randomUUID(),
            runId,
            stage: 'COMPANY',
            entityType: 'COMPANY',
            entityId: company.id,
            failureCode: err.code || 'UNKNOWN',
            message: err.message,
            attempt: newAttemptCount,
            retryable: true,
            createdAt: new Date().toISOString()
          });

          if (newAttemptCount >= 2) {
            await emitEvent({ runId, type: 'RETRY_EXHAUSTED', stage: 'COMPANY', entityType: 'COMPANY', entityId: company.id, message: `Retry exhausted for company research: ${err.message}` });
          } else {
            await emitEvent({
              runId,
              type: 'COMPANY_RESEARCH_FAILED',
              stage: 'COMPANY',
              entityType: 'COMPANY',
              entityId: company.id,
              message: `Research failed (attempt ${newAttemptCount}): ${err.message}`
            });
          }
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'COMPANY_RESEARCH_COMPLETED' }).where(eq(schema.runs.id, runId));
    }
    }

    await checkPauseOrCancel();

    // INTELLIGENCE FOUNDATION
    if (!skipFoundation) {
      await updateState('RUNNING', 'FOUNDATION');
      await emitEvent({ runId, type: 'FOUNDATION_STARTED', stage: 'FOUNDATION' });

      const runJobs = await db.select({ job: schema.jobs }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .where(eq(schema.jobObservations.runId, runId));

      for (const { job } of runJobs) {
        await checkPauseOrCancel();
        
        let company = undefined;
        if (job.companyId) {
          const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1);
          company = compRec[0];
        }

        const context = { job, company, runId };
        const oppV1Rec = await db.select().from(schema.scores).where(eq(schema.scores.jobId, job.id));
        const oppV1 = oppV1Rec.find(s => s.scoreType === 'OPPORTUNITY')?.scoreValue || 50;

        try {
          const foundationResult = await runIntelligenceFoundation(context, oppV1);
          await persistIntelligenceFoundation(foundationResult);
          await emitEvent({
            runId,
            type: 'FOUNDATION_COMPLETED',
            stage: 'FOUNDATION',
            entityType: 'JOB',
            entityId: job.id,
            message: `Foundation engine completed for job ${job.canonicalTitle}`
          });
        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          await emitEvent({
            runId,
            type: 'FOUNDATION_FAILED',
            stage: 'FOUNDATION',
            entityType: 'JOB',
            entityId: job.id,
            message: `Foundation failed: ${err.message}`
          });
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'FOUNDATION_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

    await checkPauseOrCancel();

    // COMPETITION INTELLIGENCE
    if (!skipCompetition) {
      await updateState('RUNNING', 'COMPETITION');
      await emitEvent({ runId, type: 'COMPETITION_STARTED', stage: 'COMPETITION' });

      const runJobs = await db.select({ job: schema.jobs }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .where(eq(schema.jobObservations.runId, runId));

      for (const { job } of runJobs) {
        await checkPauseOrCancel();
        
        let company = undefined;
        if (job.companyId) {
          const compRec = await db.select().from(schema.companies).where(eq(schema.companies.id, job.companyId)).limit(1);
          company = compRec[0];
        }

        const evidenceItemsRaw = await db.select().from(schema.evidenceItems)
          .innerJoin(schema.opportunityEvidence, eq(schema.evidenceItems.opportunityEvidenceId, schema.opportunityEvidence.id))
          .where(eq(schema.opportunityEvidence.jobId, job.id));
        
        const foundationEvidence = evidenceItemsRaw.map(row => ({
          id: row.evidence_items.id,
          title: row.evidence_items.title,
          description: row.evidence_items.description || '',
          observedValue: row.evidence_items.observedValue || '',
          normalizedValue: row.evidence_items.normalizedValue || '',
          weight: row.evidence_items.weight || 1,
          confidence: row.evidence_items.confidence || 50,
          source: row.evidence_items.source || 'unknown',
          timestamp: row.evidence_items.timestamp,
          category: row.evidence_items.category as any,
          metadata: row.evidence_items.metadata ? JSON.parse(String(row.evidence_items.metadata)) : undefined
        }));

        const foundationSignalsRec = await db.select().from(schema.observableSignals)
          .where(eq(schema.observableSignals.jobId, job.id));
        
        const foundationSignals = foundationSignalsRec.map(s => ({
          type: s.signalType,
          value: s.observedValue
        }));

        const foundationConfRec = await db.select().from(schema.confidenceResults)
          .where(eq(schema.confidenceResults.jobId, job.id)).limit(1);
        const foundationConfidence = foundationConfRec[0]?.confidenceScore || 50;

        const context = {
          job,
          company,
          runId,
          foundationEvidence,
          foundationConfidence,
          foundationSignals
        };

        try {
          const competitionResult = await runCompetitionIntelligence(context);
          await persistCompetitionIntelligence(competitionResult);
          await emitEvent({
            runId,
            type: 'COMPETITION_COMPLETED',
            stage: 'COMPETITION',
            entityType: 'JOB',
            entityId: job.id,
            message: `Competition estimated for job ${job.canonicalTitle}: ${competitionResult.result.level}`
          });
        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          await emitEvent({
            runId,
            type: 'COMPETITION_FAILED',
            stage: 'COMPETITION',
            entityType: 'JOB',
            entityId: job.id,
            message: `Competition failed: ${err.message}`
          });
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'COMPETITION_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

    await checkPauseOrCancel();

    // COMPANY OPPORTUNITY INTELLIGENCE
    if (!skipCompanyOpportunity) {
      await updateState('RUNNING', 'COMPANY_OPPORTUNITY');
      await emitEvent({ runId, type: 'COMPANY_OPPORTUNITY_STARTED', stage: 'COMPANY_OPPORTUNITY' });

      // Group by company
      const runJobs = await db.select({ job: schema.jobs, company: schema.companies }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
        .where(eq(schema.jobObservations.runId, runId));

      const companyGroups = new Map<string, typeof runJobs>();
      for (const row of runJobs) {
        if (row.company) {
          const cid = row.company.id;
          if (!companyGroups.has(cid)) companyGroups.set(cid, []);
          companyGroups.get(cid)!.push(row);
        }
      }

      for (const [companyId, rows] of companyGroups.entries()) {
        await checkPauseOrCancel();
        const firstRow = rows[0];
        if (!firstRow) continue;
        const company = firstRow.company!;
        const jobsForCompany = rows.map(r => r.job);

        const foundationEvidenceByJob: Record<string, any[]> = {};
        const foundationSignalsByJob: Record<string, any[]> = {};
        const competitionResultsByJob: Record<string, any> = {};

        for (const job of jobsForCompany) {
          // get signals
          const sigs = await db.select().from(schema.observableSignals).where(eq(schema.observableSignals.jobId, job.id));
          foundationSignalsByJob[job.id] = sigs.map(s => ({ type: s.signalType, value: s.observedValue }));

          // get comp
          const comp = await db.select().from(schema.competitionResults).where(eq(schema.competitionResults.jobId, job.id)).limit(1);
          if (comp[0]) competitionResultsByJob[job.id] = comp[0];
        }

        const context = {
          company,
          jobsForCompany,
          runId,
          foundationEvidenceByJob,
          foundationSignalsByJob,
          competitionResultsByJob
        };

        try {
          const oppResult = await runCompanyOpportunityIntelligence(context);
          await persistCompanyOpportunityIntelligence(oppResult);
          await emitEvent({
            runId,
            type: 'COMPANY_OPPORTUNITY_COMPLETED',
            stage: 'COMPANY_OPPORTUNITY',
            entityType: 'COMPANY',
            entityId: company.id,
            message: `Company opportunity evaluated for ${company.displayName}: ${oppResult.result.level}`
          });
        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          await emitEvent({
            runId,
            type: 'COMPANY_OPPORTUNITY_FAILED',
            stage: 'COMPANY_OPPORTUNITY',
            entityType: 'COMPANY',
            entityId: company.id,
            message: `Company opportunity failed: ${err.message}`
          });
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'COMPANY_OPPORTUNITY_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

    await checkPauseOrCancel();

    // RANKING
    await updateState('RUNNING', 'RANKING');
    
    // FINISH
    const finalFailures = await db.select().from(schema.failures).where(eq(schema.failures.runId, runId));
    const unrecoveredFailures = finalFailures.filter(f => f.attempt >= 2 || !f.retryable);
    
    let finalStatus = 'COMPLETED';
    if (finalFailures.length > 0) {
      const runJobs = await db.select().from(schema.jobObservations).where(eq(schema.jobObservations.runId, runId));
      const finalDecisions = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
      
      const successfulDecisions = finalDecisions.filter(d => d.decision !== 'FAILED');
      
      if (runJobs.length > 0 && successfulDecisions.length === 0) {
        finalStatus = 'FAILED';
      } else {
        finalStatus = 'COMPLETED_WITH_FAILURES';
      }
    }

    await updateState(finalStatus, 'FINISHED');
    await db.update(schema.runs).set({ completedAt: new Date().toISOString() }).where(eq(schema.runs.id, runId));
    await emitEvent({ runId, type: 'RUN_COMPLETED', stage: 'FINISH', message: `Mission finished with status: ${finalStatus}` });
    
  } catch (error: any) {
    if (error.message === 'Mission Cancelled' || error.name === 'AbortError') {
      console.log(`[ORCHESTRATOR] Mission ${runId} cancelled cleanly.`);
    } else {
      console.error(`[ORCHESTRATOR] Fatal Error in run ${runId}`, error);
      await updateState('FAILED', 'FAILED');
      await db.update(schema.runs).set({ errorSummary: error.message, executorId: null }).where(eq(schema.runs.id, runId));
      await emitEvent({ runId, type: 'RUN_FAILED', stage: 'FAILED', message: error.message });
    }
  }
}
