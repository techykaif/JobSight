import { describe, it, expect } from 'vitest';
import { runHardFilters } from '../lib/qualification/hardFilters.js';
import type { CandidateProfile } from '../lib/qualification/schema.js';

const baseProfile: CandidateProfile = {
  name: 'Test Candidate',
  yearsOfProfessionalExperience: 3,
  skills: [],
  targetRoles: [],
  technologies: [],
};

const baseConfig = {
  excludedCompanies: [],
  roles: [],
  remoteRequirement: 'ANY',
  requireSalaryDisclosure: false,
};

const baseJob = {
  title: 'Software Engineer',
  company: 'Acme Inc',
  status: 'ACTIVE',
  remoteType: 'REMOTE',
  candidateRemoteEligibility: 'ELIGIBLE',
  salaryMinOriginal: null,
  salaryMaxOriginal: null,
  salaryTextOriginal: null,
};

describe('Remote Eligibility Filtering', () => {
  it('India remote ELIGIBLE passes', () => {
    const job = {
      ...baseJob,
      candidateRemoteEligibility: 'ELIGIBLE',
      remoteType: 'REMOTE',
    };
    const result = runHardFilters(job, { ...baseConfig }, baseProfile);
    expect(result.passed).toBe(true);
  });

  it('US-only remote NOT_ELIGIBLE rejected for India', () => {
    const job = {
      ...baseJob,
      candidateRemoteEligibility: 'NOT_ELIGIBLE',
    };
    const result = runHardFilters(job, { ...baseConfig }, baseProfile);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('REMOTE_ELIGIBILITY: NOT_ELIGIBLE');
  });

  it('EU-only rejection when not allowed', () => {
    const job = {
      ...baseJob,
      candidateRemoteEligibility: 'NOT_ELIGIBLE',
    };
    const result = runHardFilters(job, { ...baseConfig }, baseProfile);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('REMOTE_ELIGIBILITY: NOT_ELIGIBLE');
  });

  it('unknown remote eligibility adds unknown but passes', () => {
    const job = {
      ...baseJob,
      candidateRemoteEligibility: null,
    };
    const result = runHardFilters(job, { ...baseConfig }, baseProfile);
    expect(result.passed).toBe(true);
    expect(result.unknowns).toContain('candidateRemoteEligibility');
  });

  it('ONSITE job rejected when REMOTE_ONLY required', () => {
    const job = {
      ...baseJob,
      remoteType: 'ONSITE',
      candidateRemoteEligibility: 'ELIGIBLE',
    };
    const config = {
      ...baseConfig,
      remoteRequirement: 'REMOTE_ONLY',
    };
    const result = runHardFilters(job, config, baseProfile);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('REMOTE_INCOMPATIBLE: ONSITE');
  });
});

describe('Salary Disclosure Filtering', () => {
  it('salary missing + disclosure required -> rejected', () => {
    const job = {
      ...baseJob,
      salaryMinOriginal: null,
      salaryMaxOriginal: null,
      salaryTextOriginal: null,
    };
    const config = {
      ...baseConfig,
      requireSalaryDisclosure: true,
    };
    const result = runHardFilters(job, config, baseProfile);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('SALARY_NOT_DISCLOSED');
  });

  it('salary missing + disclosure optional -> passes', () => {
    const job = {
      ...baseJob,
      salaryMinOriginal: null,
      salaryMaxOriginal: null,
      salaryTextOriginal: null,
    };
    const config = {
      ...baseConfig,
      requireSalaryDisclosure: false,
    };
    const result = runHardFilters(job, config, baseProfile);
    expect(result.passed).toBe(true);
    expect(result.unknowns).toContain('salary');
  });

  it('disclosed salary continues', () => {
    const job = {
      ...baseJob,
      salaryMinOriginal: 50000,
      salaryMaxOriginal: null,
      salaryTextOriginal: null,
    };
    const config = {
      ...baseConfig,
      requireSalaryDisclosure: true,
    };
    const result = runHardFilters(job, config, baseProfile);
    expect(result.passed).toBe(true);
  });

  it('salary text original counts as disclosed', () => {
    const job = {
      ...baseJob,
      salaryMinOriginal: null,
      salaryMaxOriginal: null,
      salaryTextOriginal: '$100k - $150k',
    };
    const config = {
      ...baseConfig,
      requireSalaryDisclosure: true,
    };
    const result = runHardFilters(job, config, baseProfile);
    expect(result.passed).toBe(true);
  });
});
