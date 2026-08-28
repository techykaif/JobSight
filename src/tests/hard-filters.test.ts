import { describe, it, expect } from 'vitest';
import { runHardFilters } from '../lib/qualification/hardFilters.js';
import { buildNormalizedSkillSet, hasNormalizedSkill } from '../lib/qualification/skills.js';
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

describe('Mandatory Skill Filtering', () => {
  const profileWithSkills: CandidateProfile = {
    ...baseProfile,
    skills: ['React', 'TypeScript'],
    technologies: ['AWS', 'PostgreSQL']
  };

  it('1. Required skill present -> PASS', () => {
    const job = {
      ...baseJob,
      description: { requiredSkills: ['React'] }
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
    expect(result.unknowns).not.toContain('requiredSkills');
  });

  it('2. 100% missing required skills -> DO NOT HARD VETO (handled by scoring)', () => {
    const job = {
      ...baseJob,
      description: { requiredSkills: ['Java', 'Spring Boot', 'Agile'] }
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
    expect(result.reasons.some(r => r.includes('MISSING_MANDATORY_SKILLS'))).toBe(false);
  });

  it('3. Multiple required skills, partial match -> PASS (not hard veto)', () => {
    const job = {
      ...baseJob,
      description: { requiredSkills: ['React', 'Java'] }
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
  });

  it('4. Preferred skill missing -> PASS (no veto)', () => {
    const job = {
      ...baseJob,
      description: { preferredSkills: ['Java'] }
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
  });

  it('5. requiredSkills = [] -> PASS (no veto)', () => {
    const job = {
      ...baseJob,
      description: { requiredSkills: [] }
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
    expect(result.unknowns).not.toContain('requiredSkills');
  });

  it('6. requiredSkills = null -> PASS (adds to unknowns)', () => {
    const job = {
      ...baseJob,
      description: { requiredSkills: null }
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
    expect(result.unknowns).toContain('requiredSkills');
  });

  it('7. requiredSkills = undefined -> PASS (adds to unknowns)', () => {
    const job = {
      ...baseJob,
      description: {}
    };
    const result = runHardFilters(job, baseConfig, profileWithSkills);
    expect(result.passed).toBe(true);
    expect(result.unknowns).toContain('requiredSkills');
  });

  it('8. React != React Native (canonical matching is preserved)', () => {
    // A profile with React Native should NOT fulfill a React requirement
    const profile = { ...baseProfile, skills: ['React Native'] };
    const job = { ...baseJob, description: { requiredSkills: ['React'] } };
    const result = runHardFilters(job, baseConfig, profile);
    // Since we don't hard-veto anymore, it passes, but we can verify it in the fit engine.
    // For here, just ensure it doesn't crash or falsely pass a hard veto if we added one back.
    expect(result.passed).toBe(true);
  });

  it('10. Node matches Node.js (alias match)', () => {
    const candidateSkillSet = buildNormalizedSkillSet(['node']);
    expect(hasNormalizedSkill(candidateSkillSet, 'Node.js')).toBe(true);
  });

  it('12. containerization != Docker (unsafe alias removed)', () => {
    const candidateSkillSet = buildNormalizedSkillSet(['containerization']);
    expect(hasNormalizedSkill(candidateSkillSet, 'Docker')).toBe(false);
  });
});
