import { evaluateGeographicEligibility } from '../geographic-eligibility/evaluator.js';
import { enrichJobFromHtml } from './html-enrichment.js';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { emitEvent } from './events';
import { runIngestionPipeline } from './ingestion';
import { qualifyJob } from '../qualification/engine';
import { getCompanyIntelligence } from '../company/engine';
import { runIntelligenceFoundation, persistIntelligenceFoundation } from '../intelligence-foundation/index.js';
import { runCompetitionIntelligence, persistCompetitionIntelligence } from '../competition/index.js';
import { runCompanyOpportunityIntelligence, persistCompanyOpportunityIntelligence } from '../company-opportunity/index.js';
import { runDiscoveryIntelligence, persistDiscoveryIntelligence } from '../discovery-intelligence/index.js';
import type { DiscoveryIntelligenceContext } from '../discovery-intelligence/interfaces.js';
import { runApplicationIntelligence, persistApplicationIntelligence } from '../application-intelligence/index.js';
import type { ApplicationIntelligenceContext } from '../application-intelligence/interfaces.js';
import { CandidateProfileSchema, type CandidateProfile } from '../qualification/schema';
import { checkDiscoveryUrlSafety } from '../discovery/url-safety.js';
import { checkSecondaryEvidence, persistSecondaryEvidence } from './secondary-evidence.js';
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
    const skipPreflight = ['PREFLIGHT_COMPLETED', 'DISCOVERY_COMPLETED', 'QUALIFICATION_COMPLETED', 'COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipDiscovery = ['DISCOVERY_COMPLETED', 'QUALIFICATION_COMPLETED', 'COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipQualification = ['QUALIFICATION_COMPLETED', 'COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipCompanyResearch = ['COMPANY_RESEARCH_COMPLETED', 'FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipFoundation = ['FOUNDATION_COMPLETED', 'COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipCompetition = ['COMPETITION_COMPLETED', 'COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipCompanyOpportunity = ['COMPANY_OPPORTUNITY_COMPLETED', 'DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipDiscoveryIntelligence = ['DISCOVERY_INTELLIGENCE_COMPLETED', 'APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');
    const skipApplicationIntelligence = ['APPLICATION_INTELLIGENCE_COMPLETED'].includes(lastCp || '');

    if (lastCp) {
      await emitEvent({ runId, type: 'RUN_RESUMED_FROM_CHECKPOINT', stage: 'START', message: `Resuming run from checkpoint: ${lastCp}` });
    } else {
      await emitEvent({ runId, type: 'RUN_STARTED', stage: 'START', message: 'Initializing mission.' });
    }

    const configRec = await db.select().from(schema.huntConfigs).where(eq(schema.huntConfigs.id, run.configId)).limit(1);
    if (!configRec[0]) throw new Error('Hunt config not found');
    config = configRec[0];

    if (!run.startedAt) {
      await db.update(schema.runs).set({ startedAt: new Date().toISOString() }).where(eq(schema.runs.id, runId));
    }

    if (!run.profileSnapshot) {
      const profileRec = await db.select().from(schema.profiles).limit(1);
      if (!profileRec[0]) throw new Error('Candidate profile not found');
      profile = profileRec[0];
      await db.update(schema.runs).set({ profileSnapshot: profile }).where(eq(schema.runs.id, runId));
    } else {
      const snapshot = run.profileSnapshot as Record<string, any>;
      if (snapshot && typeof snapshot === 'object' && 'profileId' in snapshot && 'profile' in snapshot && typeof snapshot.profile === 'object') {
        profile = {
          name: snapshot.profileName,
          ...snapshot.profile
        };
      } else {
        profile = snapshot;
      }
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
        const existingDec = await db.select().from(schema.decisions).where(and(eq(schema.decisions.jobId, job.id), eq(schema.decisions.runId, runId))).limit(1);
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
          let artifactRes = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.entityId, job.id)).limit(1);
          let sourceRes = await db.select().from(schema.jobSources).where(eq(schema.jobSources.jobId, job.id)).limit(1);
          let artifact = artifactRes[0];
          let source = sourceRes[0];

          // JUST-IN-TIME SOURCE VERIFICATION
          if (source && source.sourceUrl && !source.httpStatus) {
            const safetyCheck = checkDiscoveryUrlSafety(source.sourceUrl);
            if (safetyCheck.safe) {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                const res = await fetch(source.sourceUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                source.httpStatus = res.status;
                source.retrievedAt = new Date().toISOString();

                await db.update(schema.jobSources)
                  .set({ httpStatus: res.status, retrievedAt: source.retrievedAt })
                  .where(eq(schema.jobSources.id, source.id));

                if (res.ok) {
                  const text = await res.text();
                  if (text && text.trim().length > 0) {
                    await db.insert(schema.researchArtifacts).values({
                      id: crypto.randomUUID(),
                      runId,
                      entityType: 'JOB',
                      entityId: job.id,
                      workerType: 'SOURCE_VERIFICATION',
                      rawContent: text,
                      createdAt: new Date().toISOString()
                    });

                    // Reload artifact
                    artifactRes = await db.select().from(schema.researchArtifacts).where(eq(schema.researchArtifacts.entityId, job.id)).limit(1);
                    artifact = artifactRes[0];
                  }
                }
              } catch (e) {
                console.warn(`[QUALIFY] Failed to verify source ${source.sourceUrl}`, (e as Error).message);
              }
            } else {
              console.warn(`[QUALIFY] Unsafe URL bypassed verification: ${source.sourceUrl} - ${safetyCheck.reason}`);
            }
          }

          const hasArtifact = !!artifact && !!artifact.rawContent && artifact.rawContent.trim().length > 0;
          const hasSuccessfulFetch = source && source.httpStatus !== null && source.httpStatus >= 200 && source.httpStatus < 300;
          const hasEvidence = hasArtifact || hasSuccessfulFetch;


          // ★ HTML ENRICHMENT ★
          if (hasArtifact) {
            try {
              const enriched = await enrichJobFromHtml(artifact!.rawContent as string, abortSignal);
              if (enriched) {
                // Safely update job fields without overwriting known values with empty ones
                // REQUIRED DATA-LINEAGE INVARIANT: Original fields are immutable and must NEVER be overwritten.
                if (enriched.salaryMin !== null && enriched.salaryMin !== undefined) { job.salaryMin = enriched.salaryMin; }
                if (enriched.salaryMax !== null && enriched.salaryMax !== undefined) { job.salaryMax = enriched.salaryMax; }
                if (enriched.salaryCurrency && enriched.salaryCurrency.trim().length > 0) { job.salaryCurrency = enriched.salaryCurrency; }
                if (enriched.salaryPeriod && enriched.salaryPeriod.trim().length > 0) { job.salaryPeriod = enriched.salaryPeriod; }
                if (enriched.remoteType && enriched.remoteType.trim().length > 0) { job.remoteType = enriched.remoteType; }
                if (enriched.employmentType && enriched.employmentType.trim().length > 0) { job.employmentType = enriched.employmentType; }
                if (enriched.location && enriched.location.trim().length > 0) { job.location = enriched.location; }
                if (enriched.experienceMin !== null && enriched.experienceMin !== undefined) { job.experienceMin = enriched.experienceMin; }
                if (enriched.experienceMax !== null && enriched.experienceMax !== undefined) { job.experienceMax = enriched.experienceMax; }
                if (enriched.postingDate && enriched.postingDate.trim().length > 0) { (job as any).postingDate = enriched.postingDate; }

                // Construct structured description for Candidate Fit
                let currentDesc: any = {};
                if (job.description) {
                  try { currentDesc = typeof job.description === 'string' ? JSON.parse(job.description) : job.description; } catch(e) {}
                }
                const newDesc = {
                  summary: (enriched.jobDescription && enriched.jobDescription.trim().length > 0) ? enriched.jobDescription : (currentDesc.summary || null),
                  requiredSkills: (enriched.requiredSkills && enriched.requiredSkills.length > 0) ? enriched.requiredSkills : (currentDesc.requiredSkills || []),
                  preferredSkills: (enriched.preferredSkills && enriched.preferredSkills.length > 0) ? enriched.preferredSkills : (currentDesc.preferredSkills || [])
                };
                // Store serialized description back into memory
                job.description = JSON.stringify(newDesc);

                // Run B6 Geographic Eligibility again with new data
                const b6Result = evaluateGeographicEligibility(
                  job.location,
                  newDesc.summary,
                  job.remoteType,
                  config.candidateCountry
                );
                job.candidateRemoteEligibility = b6Result.eligibilityStatus === 'NEEDS_VERIFICATION' ? 'UNKNOWN' : b6Result.eligibilityStatus;
                job.geographicRemoteScope = b6Result.remoteScope;
                job.geographicEligibilityReason = b6Result.eligibilityReason;
                job.geographicEligibilityConfidence = b6Result.eligibilityConfidence;

                // Set the parsed description on the job object so Candidate Fit doesn't fail accessing it
                job.description = newDesc as any;

                // IMPORTANT: We must update the DB here so the enriched fields are persisted BEFORE QualifyJob runs.
                await db.update(schema.jobs).set({
                   salaryMin: job.salaryMin,
                   salaryMax: job.salaryMax,
                   salaryCurrency: job.salaryCurrency,
                   salaryPeriod: job.salaryPeriod,
                   remoteType: job.remoteType,
                   employmentType: job.employmentType,
                   location: job.location,
                   experienceMin: job.experienceMin,
                   experienceMax: job.experienceMax,
                   postingDate: job.postingDate,
                   description: JSON.stringify(newDesc),
                   candidateRemoteEligibility: job.candidateRemoteEligibility,
                   geographicRemoteScope: job.geographicRemoteScope,
                   geographicEligibilityReason: job.geographicEligibilityReason,
                   geographicEligibilityConfidence: job.geographicEligibilityConfidence
                }).where(eq(schema.jobs.id, job.id));

                // RE-EVALUATE CANDIDATE FIT (after enrichment discovery of experience/skills)
                try {
                  const { evaluateCandidateFit } = await import('../candidate-fit/engine.js');
                  const candidateJobPayload = {
                    company: { name: 'Unknown' }, // Not used by fit logic directly, but required by schema
                    job: {
                      title: job.canonicalTitle || job.normalizedTitle || 'Unknown Role',
                      url: 'http://internal.invalid',
                      status: 'ACTIVE' as const
                    },
                    experience: {
                      minYears: job.experienceMin,
                      maxYears: job.experienceMax
                    },
                    description: {
                      summary: newDesc.summary,
                      requiredSkills: newDesc.requiredSkills,
                      preferredSkills: newDesc.preferredSkills
                    }
                  };
                  await evaluateCandidateFit(runId, job.id, candidateJobPayload);
                } catch (fitErr) {
                  console.warn(`[ENRICHMENT] Failed to re-evaluate candidate fit for job ${job.id}`, fitErr);
                }
              }
            } catch (e) {
              console.warn(`[ENRICHMENT] Failed for job ${job.id}`, e);
            }
          } else {
             // If we did not enrich, ensure job.description is an object for Candidate Fit
             if (job.description && typeof job.description === 'string') {
               try { job.description = JSON.parse(job.description); } catch(e) {}
             }
          }

          let qResult;
          if (!hasEvidence) {
            qResult = {
              decision: 'SKIP' as const,
              reasons: ['Insufficient verified source evidence.'],
              unknowns: ['rawContent', 'httpStatus'],
              scores: { resumeMatch: 0, requirementMatch: 0, opportunity: 0, confidence: 0 },
              analysis: null
            };
          } else {
            qResult = await qualifyJob(job, config, validProfile, abortSignal);
          }

          db.transaction((tx) => {
            tx.delete(schema.decisions).where(and(eq(schema.decisions.runId, runId), eq(schema.decisions.jobId, job.id))).run();
            tx.insert(schema.decisions).values({
            id: crypto.randomUUID(),
            runId,
            jobId: job.id,
            decision: qResult.decision,
            reasons: qResult.reasons,
            unknowns: qResult.unknowns,
            createdAt: new Date().toISOString()
          }).run();
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

            await db.delete(schema.decisions).where(and(eq(schema.decisions.runId, runId), eq(schema.decisions.jobId, job.id)));
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
        .where(and(
          eq(schema.decisions.runId, runId),
          inArray(schema.decisions.decision, ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'])
        ));

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
          .where(and(eq(schema.scores.jobId, job.id), eq(schema.scores.runId, runId)));
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
        const oppV1Rec = await db.select().from(schema.scores).where(and(eq(schema.scores.jobId, job.id), eq(schema.scores.runId, runId)));
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

    
    // COMPETITION (Legacy - Disconnected in Phase 7.3 Canonical Opportunity Quality)
    if (!skipCompetition) {
      await updateState('RUNNING', 'COMPETITION');
      await emitEvent({ runId, type: 'COMPETITION_STARTED', stage: 'COMPETITION' });
      // Legacy competition module disconnected. Canonical Opportunity Quality handles competition natively.
      await emitEvent({ runId, type: 'COMPETITION_COMPLETED', stage: 'COMPETITION', message: 'Legacy competition bypassed.' });
      await db.update(schema.runs).set({ lastCheckpoint: 'COMPETITION_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

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
          const sigs = await db.select().from(schema.observableSignals).where(and(eq(schema.observableSignals.jobId, job.id), eq(schema.observableSignals.runId, runId)));
          foundationSignalsByJob[job.id] = sigs.map(s => ({ type: s.signalType, value: s.observedValue }));

          // get comp
          const comp = await db.select().from(schema.competitionResults).where(and(eq(schema.competitionResults.jobId, job.id), eq(schema.competitionResults.runId, runId))).limit(1);
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

    // MARKET INTELLIGENCE
    const skipMarketIntelligence = false;
    if (!skipMarketIntelligence) {
      await updateState('RUNNING', 'MARKET_INTELLIGENCE');
      await emitEvent({ runId, type: 'MARKET_INTELLIGENCE_STARTED', stage: 'MARKET_INTELLIGENCE' });

      const runJobs = await db.select({
        job: schema.jobs,
        source: schema.jobSources,
        artifact: schema.researchArtifacts
      }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .leftJoin(schema.jobSources, eq(schema.jobs.id, schema.jobSources.jobId))
        .leftJoin(schema.researchArtifacts, eq(schema.jobs.id, schema.researchArtifacts.entityId))
        .where(eq(schema.jobObservations.runId, runId));

      const similarJobsInRun = runJobs.map(r => r.job);

      // We only want one artifact per job (e.g. the first one)
      const artifactMap = new Map<string, string>();
      for (const row of runJobs) {
        if (row.artifact && !artifactMap.has(row.job.id)) {
          artifactMap.set(row.job.id, row.artifact.rawContent);
        }
      }

      // We only process each job once
      const processedJobIds = new Set<string>();

      const { evaluateCanonicalOpportunityQuality } = await import('../opportunity-quality/engine.js');
      const { saveCanonicalOpportunityQuality } = await import('../opportunity-quality/repository.js');

      for (const row of runJobs) {
        if (processedJobIds.has(row.job.id)) continue;
        processedJobIds.add(row.job.id);

        await checkPauseOrCancel();

        try {
          const context: any = {
            job: row.job as any,
            runId,
            similarJobsInRun: similarJobsInRun as any
          };
          if (row.source?.sourceUrl) context.sourceUrl = row.source.sourceUrl;
          if (row.source?.sourceType) context.sourceProviderType = row.source.sourceType;
          if (artifactMap.get(row.job.id)) context.rawContent = artifactMap.get(row.job.id);

          const crossRefResults = await checkSecondaryEvidence(row.job as any, context.sourceProviderType);
          await persistSecondaryEvidence(row.job.id, runId, crossRefResults);
          
          let aggregatedResult = crossRefResults.find(r => r.status === 'OBSERVED_ON_SOURCE');
          if (!aggregatedResult) {
            const notObserved = crossRefResults.filter(r => r.status === 'NOT_OBSERVED_ON_CHECKED_SOURCES');
            if (notObserved.length > 0) {
              aggregatedResult = {
                status: 'NOT_OBSERVED_ON_CHECKED_SOURCES',
                targetSource: notObserved.map(n => n.targetSource).join(','),
                matchStrength: 'NONE'
              };
            } else {
              aggregatedResult = crossRefResults[0];
            }
          }
          context.secondaryEvidence = aggregatedResult;

          const result = evaluateCanonicalOpportunityQuality(context);
          
          await saveCanonicalOpportunityQuality(runId, row.job.id, result);

          // Update legacy OPPORTUNITY score for UI compatibility
          let legacyScore = 50;
          if (result.opportunityLevel === 'FAVORABLE') legacyScore = 85;
          else if (result.opportunityLevel === 'NEUTRAL') legacyScore = 65;
          else if (result.opportunityLevel === 'UNFAVORABLE') legacyScore = 30;

          await db.update(schema.scores)
            .set({ scoreValue: legacyScore })
            .where(and(
              eq(schema.scores.jobId, row.job.id),
              eq(schema.scores.runId, runId),
              eq(schema.scores.scoreType, 'OPPORTUNITY')
            ));


          await emitEvent({
            runId,
            type: 'MARKET_INTELLIGENCE_COMPLETED',
            stage: 'MARKET_INTELLIGENCE',
            entityType: 'JOB',
            entityId: row.job.id,
            message: `Market intelligence evaluated: ${result.opportunityLevel}`
          });
        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          await emitEvent({
            runId,
            type: 'MARKET_INTELLIGENCE_FAILED',
            stage: 'MARKET_INTELLIGENCE',
            entityType: 'JOB',
            entityId: row.job.id,
            message: `Market intelligence failed: ${err.message}`
          });
        }
      }
    }

    await checkPauseOrCancel();

    // DISCOVERY INTELLIGENCE
    if (!skipDiscoveryIntelligence) {
      await updateState('RUNNING', 'DISCOVERY_INTELLIGENCE');
      await emitEvent({ runId, type: 'DISCOVERY_INTELLIGENCE_STARTED', stage: 'DISCOVERY_INTELLIGENCE' });

      // Load all job observations for this run
      const runJobs = await db.select({
        job: schema.jobs,
        company: schema.companies,
        observation: schema.jobObservations,
        source: schema.jobSources
      }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
        .leftJoin(schema.jobSources, eq(schema.jobs.id, schema.jobSources.jobId))
        .where(eq(schema.jobObservations.runId, runId));

      const similarJobsInRun = runJobs.map(r => r.job);

      for (const row of runJobs) {
        await checkPauseOrCancel();
        const { job, company, observation, source } = row;

        // get signals
        const sigs = await db.select().from(schema.observableSignals).where(and(eq(schema.observableSignals.jobId, job.id), eq(schema.observableSignals.runId, runId)));
        const foundationSignals = sigs.map(s => ({ type: s.signalType, value: s.observedValue }));

        // get comp
        const comp = await db.select().from(schema.competitionResults).where(and(eq(schema.competitionResults.jobId, job.id), eq(schema.competitionResults.runId, runId))).limit(1);
        const competitionResult = comp[0] ? comp[0] : undefined;

        // get company opp
        let companyOpportunityResult = undefined;
        if (company) {
          const compOpp = await db.select().from(schema.companyOpportunity).where(and(eq(schema.companyOpportunity.companyId, company.id), eq(schema.companyOpportunity.runId, runId))).limit(1);
          if (compOpp[0]) companyOpportunityResult = compOpp[0];
        }

        const context: DiscoveryIntelligenceContext = {
          job,
          runId,
          observation,
          foundationEvidence: [], // omitting raw evidence for brevity in discovery intel
          foundationSignals,
          similarJobsInRun
        };

        if (company) context.company = company;
        if (source) context.source = source;
        if (competitionResult) context.competitionResult = competitionResult as any;
        if (companyOpportunityResult) context.companyOpportunityResult = companyOpportunityResult as any;

        try {
          const discResult = await runDiscoveryIntelligence(context);
          await persistDiscoveryIntelligence(discResult);
          await emitEvent({
            runId,
            type: 'DISCOVERY_INTELLIGENCE_COMPLETED',
            stage: 'DISCOVERY_INTELLIGENCE',
            entityType: 'JOB',
            entityId: job.id,
            message: `Discovery intelligence evaluated: ${discResult.result.level}`
          });
        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          await emitEvent({
            runId,
            type: 'DISCOVERY_INTELLIGENCE_FAILED',
            stage: 'DISCOVERY_INTELLIGENCE',
            entityType: 'JOB',
            entityId: job.id,
            message: `Discovery intelligence failed: ${err.message}`
          });
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'DISCOVERY_INTELLIGENCE_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

    // APPLICATION INTELLIGENCE
    if (!skipApplicationIntelligence) {
      await updateState('RUNNING', 'APPLICATION_INTELLIGENCE');
      await emitEvent({ runId, type: 'APPLICATION_INTELLIGENCE_STARTED', stage: 'APPLICATION_INTELLIGENCE' });

      const runJobs = await db.select({
        job: schema.jobs,
        company: schema.companies
      }).from(schema.jobObservations)
        .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
        .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
        .where(eq(schema.jobObservations.runId, runId));

      for (const row of runJobs) {
        await checkPauseOrCancel();
        const { job, company } = row;

        // get candidate profile
        let candidateProfile: CandidateProfile | undefined;
        const prof = await db.select().from(schema.profiles).limit(1);
        if (prof[0]) {
          candidateProfile = prof[0] as unknown as CandidateProfile;
        }

        // get qualification
        let qualificationScore: number | undefined;
        let qualificationSkills: string[] | undefined; // Not persisted cleanly right now, graceful degradation
        const qScore = await db.select().from(schema.scores).where(and(eq(schema.scores.jobId, job.id), eq(schema.scores.runId, runId))).limit(1);
        if (qScore[0]) {
          qualificationScore = qScore[0].scoreValue;
        }

        // get comp
        const comp = await db.select().from(schema.competitionResults).where(and(eq(schema.competitionResults.jobId, job.id), eq(schema.competitionResults.runId, runId))).limit(1);
        const competitionResult = comp[0] ? comp[0] : undefined;

        // get company opp
        let companyOpportunityResult = undefined;
        if (company) {
          const compOpp = await db.select().from(schema.companyOpportunity).where(and(eq(schema.companyOpportunity.companyId, company.id), eq(schema.companyOpportunity.runId, runId))).limit(1);
          if (compOpp[0]) companyOpportunityResult = compOpp[0];
        }

        // get discovery intelligence
        const disc = await db.select().from(schema.oppDiscoveryResults).where(and(eq(schema.oppDiscoveryResults.jobId, job.id), eq(schema.oppDiscoveryResults.runId, runId))).limit(1);
        const discoveryIntelligenceOutput = disc[0] ? { result: disc[0] } as any : undefined;

        const context: ApplicationIntelligenceContext = {
          job,
          runId
        };

        if (company) context.company = company;
        if (candidateProfile) context.candidateProfile = candidateProfile;
        if (qualificationScore !== undefined) context.qualificationScore = qualificationScore;
        if (qualificationSkills) context.qualificationSkills = qualificationSkills;
        if (competitionResult) context.competitionResult = competitionResult as any;
        if (companyOpportunityResult) context.companyOpportunityResult = companyOpportunityResult as any;
        if (discoveryIntelligenceOutput) context.discoveryIntelligenceOutput = discoveryIntelligenceOutput;

        try {
          const appResult = await runApplicationIntelligence(context);
          await persistApplicationIntelligence(appResult);
          await emitEvent({
            runId,
            type: 'APPLICATION_INTELLIGENCE_COMPLETED',
            stage: 'APPLICATION_INTELLIGENCE',
            entityType: 'JOB',
            entityId: job.id,
            message: `Application intelligence evaluated: ${appResult.result.readinessLevel}`
          });
        } catch (err: any) {
          if (err.message === 'Mission Cancelled' || err.name === 'AbortError') throw err;
          await emitEvent({
            runId,
            type: 'APPLICATION_INTELLIGENCE_FAILED',
            stage: 'APPLICATION_INTELLIGENCE',
            entityType: 'JOB',
            entityId: job.id,
            message: `Application intelligence failed: ${err.message}`
          });
        }
      }

      await db.update(schema.runs).set({ lastCheckpoint: 'APPLICATION_INTELLIGENCE_COMPLETED' }).where(eq(schema.runs.id, runId));
    }

    await checkPauseOrCancel();

    // RANKING
    await updateState('RUNNING', 'RANKING');

    // 1. Find eligible candidates (passed hard filters)
    const finalEligibleDecisions = await db.select().from(schema.decisions)
      .where(eq(schema.decisions.runId, runId));

    const validJobsMap = new Map<string, any>();
    const runJobsQuery = await db.select().from(schema.jobObservations)
      .innerJoin(schema.jobs, eq(schema.jobObservations.jobId, schema.jobs.id))
      .where(eq(schema.jobObservations.runId, runId));

    for (const r of runJobsQuery) {
      validJobsMap.set(r.jobs.id, r.jobs);
    }

    const eligibleDecisions = finalEligibleDecisions.filter(d =>
      ['APPLY', 'CONSIDER', 'RESEARCH_REQUIRED'].includes(d.decision) && validJobsMap.has(d.jobId)
    );

    const stretchDecisions = finalEligibleDecisions.filter(d =>
      d.decision === 'SKIP' && Array.isArray(d.reasons) && d.reasons.some((r: any) => typeof r === 'string' && r.includes('EXTREME_EXPERIENCE_GAP')) && validJobsMap.has(d.jobId)
    );

    const { runDecisionEngine, generateDecisionQueue } = await import('../decision/engine.js');
    const { calculateB7Modifiers } = await import('../adaptive-learning/engine.js');

    const decisionsWithContext = [];

    const allDecisionsToEvaluate = [...eligibleDecisions];

    for (const ed of allDecisionsToEvaluate) {
      const job = validJobsMap.get(ed.jobId);

      // Load intelligence results needed for context
      const discRec = await db.select().from(schema.oppDiscoveryResults).where(and(eq(schema.oppDiscoveryResults.jobId, job.id), eq(schema.oppDiscoveryResults.runId, runId))).limit(1);
      const discSigs = await db.select().from(schema.oppDiscoverySignals).where(and(eq(schema.oppDiscoverySignals.jobId, job.id), eq(schema.oppDiscoverySignals.runId, runId)));

      const mktRec = await db.select()
        .from(schema.marketIntelligence)
        .where(and(
          eq(schema.marketIntelligence.jobId, job.id),
          eq(schema.marketIntelligence.runId, runId)
        ))
        .limit(1);

      const discovery = {
        result: discRec[0] || { level: 'STANDARD', score: 50, confidence: 50 },
        signals: discSigs,
        visibility: 'UNKNOWN', authenticity: 'UNKNOWN', competition: 'UNKNOWN', freshness: 'UNKNOWN'
      };

      // Attempt to load DiscoveryIntelligence summary to get authenticity/freshness if needed
      const discSumRec = await db.select().from(schema.oppDiscoverySummary).where(and(eq(schema.oppDiscoverySummary.jobId, job.id), eq(schema.oppDiscoverySummary.runId, runId))).limit(1);
      if (discSumRec[0]) {
        discovery.authenticity = discSumRec[0].authenticity;
        discovery.visibility = discSumRec[0].visibility;
        discovery.competition = discSumRec[0].competition;
      }

      
      // B7 Compatibility Adapter
      // Maps Canonical Opportunity Quality to legacy B7 numeric score requirements.
      let opportunityScore = 50;
      let priority = 'NORMAL';
      let recommendedAction = 'Consider applying';

      if (mktRec[0]) {
        const canonicalLevel = mktRec[0].opportunityIntelligence;
        if (canonicalLevel === 'FAVORABLE') {
          opportunityScore = 85;
          priority = 'URGENT';
          recommendedAction = 'Apply immediately (Highly Favorable Market Condition)';
        } else if (canonicalLevel === 'NEUTRAL') {
          opportunityScore = 65;
          priority = 'HIGH';
          recommendedAction = 'Prioritize application (Favorable conditions)';
        } else if (canonicalLevel === 'UNFAVORABLE') {
          opportunityScore = 30;
          priority = 'LOW';
          recommendedAction = 'Skip due to unfavorable market condition';
        } else if (canonicalLevel === 'INSUFFICIENT_EVIDENCE') {
          opportunityScore = 50;
          priority = 'NORMAL';
        }
      }
const opportunity = {
        opportunityScore,
        priority,
        recommendedAction
      };

      const context = {
        job,
        runId,
        configId: config.id,
        marketIntelligence: mktRec[0] || null,
        discovery: discovery as any,
        opportunity: opportunity as any
      };

      try {
        const result = await runDecisionEngine(context);
        decisionsWithContext.push({ context, result });
      } catch (err) {
        console.warn(`[RANKING] Strategy evaluation failed for ${job.id}:`, err);
      }
    }

    // Existing ranking queue (prior to B7 nudges)
    // We will generate the final queue with B7 modifiers

    // 2. Calculate B7 personalization modifier
    const learningContext = { runId, configId: config.id };
    // Pass a dummy queue to calculate traits based on what we're evaluating
    const b7QueueInput = decisionsWithContext.map((d, i) => ({
      jobId: (d.context.job as any).id,
      rank: i + 1,
      result: d.result,
      context: d.context
    }));

    const learningModifiers = await calculateB7Modifiers(learningContext, b7QueueInput);

    // 3. Final queue generation
    const finalQueue = await generateDecisionQueue(runId, decisionsWithContext, learningModifiers);

    // 4. Persist the queue
    for (const q of finalQueue) {
      await db.insert(schema.decisionQueue).values({
        id: crypto.randomUUID(),
        runId,
        jobId: (q.context.job as any).id, // Ensure we use DB ID, not sourceUrl
        queueRank: q.rank,
        decision: q.result.decision,
        recommendedAction: q.result.requiredActions?.[0] || 'CONSIDER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.insert(schema.decisionResults).values({
        id: crypto.randomUUID(),
        jobId: (q.context.job as any).id,
        runId,
        decision: q.result.decision,
        priority: q.result.priority.toString(),
        confidence: q.result.confidence,
        reasons: q.result.reasons,
        unknowns: q.result.unknowns,
        requiredActions: q.result.requiredActions,
        roiLevel: q.result.roiLevel,
        urgencyLevel: q.result.urgencyLevel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }



    // 5. Candidate Decision Intelligence (D1.7.5)
    await updateState('CANDIDATE_DECISION', 'DECISION');

    const { evaluateCandidateDecision } = await import('../candidate-decision/engine.js');
    const b7Results = await db.select().from(schema.decisionResults).where(eq(schema.decisionResults.runId, runId));
    const fitResults = await db.select().from(schema.candidateFitResults).where(eq(schema.candidateFitResults.runId, runId));
    const qualificationResults = await db.select().from(schema.decisions).where(eq(schema.decisions.runId, runId));
    const marketIntelligences = await db.select().from(schema.marketIntelligence).where(eq(schema.marketIntelligence.runId, runId));
    const currentRun = await db.select({ profileSnapshot: schema.runs.profileSnapshot })
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1)
      .get();
    const hasSnapshot = !!currentRun?.profileSnapshot;

    for (const job of validJobsMap.values()) {
      const b7Dec = b7Results.find(r => r.jobId === job.id);
      const fit = fitResults.find(r => r.jobId === job.id);
      const mktInt = marketIntelligences.find(r => r.jobId === job.id);

      const geoEligibility = {
        eligibilityStatus: job.candidateRemoteEligibility as 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_VERIFICATION' | undefined,
        remoteScope: job.geographicRemoteScope as any,
        eligibilityConfidence: job.geographicEligibilityConfidence as any,
        eligibilityReason: job.geographicEligibilityReason || ''
      };

      const qualDec = qualificationResults.find((r: any) => r.jobId === job.id);

      const decision = evaluateCandidateDecision(
        hasSnapshot,
        fit as any,
        b7Dec?.decision as any,
        geoEligibility as any,
        qualDec as any,
        mktInt as any
      );

      await db.insert(schema.candidateDecisions)
        .values({
          id: crypto.randomUUID(),
          runId,
          jobId: job.id,
          finalDecision: decision.finalDecision,
          primaryReason: decision.primaryReason,
          createdAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: [schema.candidateDecisions.runId, schema.candidateDecisions.jobId],
          set: {
            finalDecision: decision.finalDecision,
            primaryReason: decision.primaryReason,
            createdAt: new Date().toISOString()
          }
        });
    }

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
      // If the abort fired inside a deep await (bypassing checkPauseOrCancel),
      // the run status may still be RUNNING. Ensure it has a terminal state.
      // If the missionManager timeout handler already set FAILED, respect that.
      const terminalStatuses = ['COMPLETED', 'COMPLETED_WITH_FAILURES', 'FAILED', 'CANCELLED'];
      try {
        const currentState = await db.select({ status: schema.runs.status })
          .from(schema.runs)
          .where(eq(schema.runs.id, runId))
          .limit(1);
        if (currentState[0] && !terminalStatuses.includes(currentState[0].status)) {
          await updateState('CANCELLED', 'ABORTED');
        }
      } catch (stateErr) {
        console.error(`[ORCHESTRATOR] Failed to verify terminal state for run ${runId}`, stateErr);
      }
    } else {
      console.error(`[ORCHESTRATOR] Fatal Error in run ${runId}`, error);
      await updateState('FAILED', 'FAILED');
      await db.update(schema.runs).set({ errorSummary: error.message, executorId: null }).where(eq(schema.runs.id, runId));
      await emitEvent({ runId, type: 'RUN_FAILED', stage: 'FAILED', message: error.message });
    }
  }
}
