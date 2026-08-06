import { runAgyTask } from '../agy/runner.js';
import { AgyRequirementAnalysisSchema, type AgyRequirementAnalysis, type CandidateProfile, type QualificationResult } from './schema.js';
import { runHardFilters } from './hardFilters.js';
import { matchSkills } from './skills.js';
import { calculateScores, SCORING_VERSION } from './scoring.js';
import { makeDecision } from './decision.js';
import crypto from 'crypto';

export async function analyzeRequirements(
  job: any, 
  profile: CandidateProfile, 
  config: any,
  abortSignal?: AbortSignal
): Promise<AgyRequirementAnalysis | null> {
  const prompt = `
You are evaluating a candidate for a job based on strict deterministic rules.
You MUST NOT invent experience. Portfolio/project experience is NOT professional employment.

JOB:
Title: ${job.title}
Experience Required: ${job.experienceMin} - ${job.experienceMax} years
Description: ${JSON.stringify(job.description)}

CANDIDATE:
Professional Experience: ${profile.yearsOfProfessionalExperience} years
Projects: ${JSON.stringify(profile.projectExperience)}
Skills: ${JSON.stringify(profile.skills)}
Technologies: ${JSON.stringify(profile.technologies)}

Assess experience strictness, actual seniority, responsibility complexity, blockers, and positive signals.
`;

  try {
    return await runAgyTask({
      prompt,
      schema: AgyRequirementAnalysisSchema,
      jsonSchemaDef: {
        type: "object",
        properties: {
          experienceStrictness: { type: "string", enum: ["HARD", "MODERATE", "FLEXIBLE", "UNKNOWN"] },
          actualSeniority: { type: "string", enum: ["ENTRY", "JUNIOR", "EARLY_MID", "MID", "SENIOR", "UNKNOWN"] },
          responsibilityComplexity: { type: "string", enum: ["LOW", "MODERATE", "HIGH", "UNKNOWN"] },
          portfolioExperienceRelevant: { type: "boolean" },
          majorBlockers: { type: "array", items: { type: "string" } },
          positiveSignals: { type: "array", items: { type: "string" } },
          reasoning: { type: "array", items: { type: "string" } },
          confidence: { type: "number" }
        },
        required: ["experienceStrictness", "actualSeniority", "responsibilityComplexity", "portfolioExperienceRelevant", "majorBlockers", "positiveSignals", "reasoning", "confidence"]
      },
      timeoutMs: 60000,
      maxAttempts: 2,
      ...(abortSignal ? { abortSignal } : {})
    });
  } catch (error) {
    console.error('[AGY_ANALYSIS_FAILED]', error);
    return null;
  }
}

export async function qualifyJob(
  job: any,
  config: any,
  profile: CandidateProfile,
  abortSignal?: AbortSignal
): Promise<QualificationResult> {
  // 1. Hard Filters
  const hardFilter = runHardFilters(job, config, profile);

  // 2. Skills
  const candidateSkills = [...(profile.skills || []), ...(profile.technologies || [])];
  const reqSkills = job.description?.requiredSkills || [];
  const prefSkills = job.description?.preferredSkills || [];
  const skillMatch = matchSkills(candidateSkills, reqSkills, prefSkills);

  // 3. AGY Analysis (only if hard filter passes, to save time, or always for data?)
  let analysis: AgyRequirementAnalysis | null = null;
  if (hardFilter.passed) {
    analysis = await analyzeRequirements(job, profile, config, abortSignal);
  }

  // 4. Scores
  const scores = await calculateScores(job, config, profile, analysis, skillMatch);

  // 5. Decision
  const { decision, reasons } = makeDecision(hardFilter, scores, analysis);
  
  if (analysis && analysis.reasoning) {
    reasons.push(...analysis.reasoning);
  }

  return {
    decision,
    reasons,
    unknowns: hardFilter.unknowns,
    scores,
    analysis
  };
}
