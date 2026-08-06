import type { CandidateProfile, AgyRequirementAnalysis } from './schema.js';
import { matchSkills } from './skills.js';
import { evaluateSalaryAttractiveness } from '../salary/index.js';

export const SCORING_VERSION = 'opportunity_v1';

export async function calculateScores(
  job: any, 
  config: any,
  profile: CandidateProfile, 
  analysis: AgyRequirementAnalysis | null, 
  skillMatch: ReturnType<typeof matchSkills>
) {
  // CONFIDENCE
  // Based on presence of location, remote info, experience, salary, requirements
  let confidence = 0.4;
  if (job.salaryMin !== null || job.salaryMax !== null) confidence += 0.2;
  if (job.remoteType) confidence += 0.1;
  if (job.location) confidence += 0.1;
  if (job.experienceMin !== null || job.experienceMax !== null) confidence += 0.1;
  if (analysis) confidence += (analysis.confidence * 0.1);

  // REQUIREMENT_MATCH (0-100)
  // How well the candidate satisfies explicit job requirements
  let reqScore = 100;
  
  if (skillMatch.requiredTotal > 0) {
    const missing = skillMatch.requiredTotal - skillMatch.requiredMatched;
    reqScore -= (missing * 15); // penalize 15 points per missing required skill
  }

  let extremeExperienceGap = false;

  if (analysis) {
    const jobMinYears = job.experienceMin || 0;
    const diff = jobMinYears - profile.yearsOfProfessionalExperience;
    if (diff > 0) {
      if (analysis.experienceStrictness === 'HARD') {
        reqScore -= 40;
        if (diff >= 3) { // Extreme gap for a HARD requirement
          extremeExperienceGap = true;
          reqScore -= 40; // Double penalty
        }
      } else if (analysis.experienceStrictness === 'MODERATE') {
        reqScore -= 20;
        if (diff >= 4) { // Extreme gap for MODERATE
          extremeExperienceGap = true;
          reqScore -= 20;
        }
      } else {
        reqScore -= 10;
        if (diff >= 5) {
          extremeExperienceGap = true;
        }
      }
    }
  }

  // RESUME_MATCH (0-100)
  // Required + Preferred Skills + Role alignment + Experience + Relevant Projects
  let resScore = reqScore; // Start from requirement match

  if (skillMatch.preferredTotal > 0) {
    const prefRatio = skillMatch.preferredMatched / skillMatch.preferredTotal;
    resScore += (prefRatio * 15); // Up to 15 bonus points for preferred skills
  }

  if (analysis?.portfolioExperienceRelevant) {
    resScore += 10;
  }

  // OPPORTUNITY (0-100)
  // Resume Match + Remote Compatibility + Salary Compatibility
  let oppScore = resScore;
  
  if (job.remoteType) {
    if (profile.remotePreference?.includes(job.remoteType)) {
      oppScore += 10;
    }
  }

  // Salary Attractiveness
  const desiredMin = config.minimumDesiredSalary || config.salaryMinimum || profile.salaryExpectations?.minimum;
  const desiredCurrency = config.desiredSalaryCurrency || 'INR';
  const desiredPeriod = config.desiredSalaryPeriod || 'MONTH';

  const salaryAttr = await evaluateSalaryAttractiveness(
    job.salaryMinOriginal, job.salaryMaxOriginal, job.salaryCurrencyOriginal, job.salaryPeriodOriginal,
    desiredMin, desiredCurrency, desiredPeriod
  );

  if (salaryAttr === 'EXCEPTIONAL') oppScore += 30;
  else if (salaryAttr === 'HIGH') oppScore += 20;
  else if (salaryAttr === 'GOOD') oppScore += 10;
  else if (salaryAttr === 'BELOW_TARGET' || salaryAttr === 'SIGNIFICANTLY_BELOW_TARGET') {
    oppScore -= 40; // Heavy rank penalty
  }

  if (analysis?.majorBlockers?.length) {
    oppScore -= (analysis.majorBlockers.length * 20);
  }

  // Cap scores if there's an extreme experience gap
  if (extremeExperienceGap) {
    oppScore = Math.min(oppScore, 49); // Force below CONSIDER threshold
  }

  return {
    resumeMatch: Math.max(0, Math.min(100, Math.round(resScore))),
    requirementMatch: Math.max(0, Math.min(100, Math.round(reqScore))),
    opportunity: Math.max(0, Math.min(100, Math.round(oppScore))),
    confidence: Math.max(0, Math.min(1, confidence)),
    extremeExperienceGap
  };
}
