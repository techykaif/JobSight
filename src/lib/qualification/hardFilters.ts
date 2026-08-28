import type { HardFilterResult } from './schema.js';
import type { CandidateProfile } from './schema.js';
import { buildNormalizedSkillSet, hasNormalizedSkill } from './skills.js';

export function runHardFilters(job: any, config: any, profile: CandidateProfile): HardFilterResult {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  let passed = true;

  // 1. Explicitly Excluded Company
  if (config.excludedCompanies && config.excludedCompanies.length > 0) {
    if (job.company?.name && config.excludedCompanies.includes(job.company.name)) {
      passed = false;
      reasons.push(`EXCLUDED_COMPANY: ${job.company.name}`);
    }
  }

  // 2. Closed/Inactive Job
  if (job.status === 'INACTIVE') {
    passed = false;
    reasons.push('JOB_CLOSED');
  }

  // 3. Mandatory Skill Requirements
  const rawRequiredSkills = job.description?.requiredSkills;

  if (rawRequiredSkills === null || rawRequiredSkills === undefined) {
    // Requirements are unknown/unavailable — do NOT veto, track as unknown
    unknowns.push('requiredSkills');
  } else if (Array.isArray(rawRequiredSkills) && rawRequiredSkills.length > 0) {
    // Known, non-empty mandatory skill requirements — check for 0% match
    const candidateSkillSet = buildNormalizedSkillSet(
      profile.skills || [],
      profile.technologies || []
    );

    let matchedCount = 0;
    for (const reqSkill of rawRequiredSkills) {
      if (hasNormalizedSkill(candidateSkillSet, reqSkill)) {
        matchedCount++;
      }
    }

    if (matchedCount === 0) {
      passed = false;
      reasons.push(`MISSING_MANDATORY_SKILLS: Candidate matches 0/${rawRequiredSkills.length} required skills [${rawRequiredSkills.join(', ')}]`);
    }
  }
  // else: rawRequiredSkills is [] — explicitly no mandatory requirements, do NOT veto

  // 4. Remote Requirement & Eligibility
  if (config.remoteRequirement === 'REMOTE_ONLY') {
    if (job.remoteType === 'ONSITE') {
      passed = false;
      reasons.push('REMOTE_INCOMPATIBLE: ONSITE');
    } else if (!job.remoteType) {
      unknowns.push('remoteType');
    }
  }

  if (job.candidateRemoteEligibility === 'NOT_ELIGIBLE') {
    passed = false;
    reasons.push('REMOTE_ELIGIBILITY: NOT_ELIGIBLE');
  } else if (!job.candidateRemoteEligibility) {
    unknowns.push('candidateRemoteEligibility');
  }

  // 5. Salary Disclosure Requirement
  const hasSalary = (job.salaryMinOriginal !== null && job.salaryMinOriginal !== undefined) || 
                    (job.salaryMaxOriginal !== null && job.salaryMaxOriginal !== undefined) ||
                    (job.salaryTextOriginal && job.salaryTextOriginal.trim() !== '');

  if (config.requireSalaryDisclosure && !hasSalary) {
    passed = false;
    reasons.push('SALARY_NOT_DISCLOSED');
  }

  if (!hasSalary) {
    unknowns.push('salary');
  }

  return { passed, reasons, unknowns };
}
