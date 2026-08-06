import type { HardFilterResult } from './schema.js';
import type { CandidateProfile } from './schema.js';

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

  // 3. Senior Title Filtering
  if (job.title) {
    const titleLower = job.title.toLowerCase();
    const isSenior = /\b(senior|sr\.?|staff|principal|lead|manager|director|head|vp)\b/.test(titleLower);
    
    // If the hunt explicitly allows senior roles in alternativeRoles/targetRoles, we shouldn't reject.
    const allConfigRoles = [...(config.targetRoles || []), ...(config.alternativeRoles || [])].map((r: string) => r.toLowerCase());
    const expectsSenior = allConfigRoles.some((r: string) => /\b(senior|sr|staff|lead)\b/.test(r));

    if (isSenior && !expectsSenior) {
      passed = false;
      reasons.push(`SENIOR_TITLE: ${job.title}`);
    }
  }

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
