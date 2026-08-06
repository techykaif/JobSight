import { describe, it, expect, vi, beforeAll } from 'vitest';
import { normalizeJobExtraction, ValidationError } from '../lib/jobs/normalize.js';
import type { CandidateJob } from '../lib/jobs/extractionSchema.js';

describe('Pipeline Normalization and Validation', () => {
  const validCandidate: CandidateJob = {
    company: { name: '  Test Corp  ', website: 'https://test.com' },
    job: { title: ' Software Engineer ', url: 'https://test.com/job', status: 'ACTIVE' },
    compensation: { salaryMin: null, salaryMax: null },
    experience: { minYears: null },
    description: { summary: 'A great job' },
    sources: [{ url: 'https://test.com/job', type: 'OFFICIAL_JOB_PAGE' }],
    evidence: []
  };

  it('normalizes and trims strings', () => {
    const result = normalizeJobExtraction(validCandidate);
    expect(result.company.name).toBe('Test Corp');
    expect(result.job.title).toBe('Software Engineer');
  });

  it('preserves null semantics explicitly', () => {
    const result = normalizeJobExtraction(validCandidate);
    expect(result.compensation?.salaryMin).toBeNull();
    expect(result.experience?.minYears).toBeNull();
  });

  it('rejects missing company name', () => {
    const invalid = { ...validCandidate, company: { name: '' } };
    expect(() => normalizeJobExtraction(invalid)).toThrow(ValidationError);
  });

  it('rejects missing job title', () => {
    const invalid = { ...validCandidate, job: { ...validCandidate.job, title: '   ' } };
    expect(() => normalizeJobExtraction(invalid)).toThrow(ValidationError);
  });

  it('rejects missing source provenance', () => {
    const invalid = { ...validCandidate, sources: [] };
    expect(() => normalizeJobExtraction(invalid)).toThrow(ValidationError);
  });

  it('rejects illogical compensation bounds', () => {
    const invalid = { 
      ...validCandidate, 
      compensation: { salaryMin: 200000, salaryMax: 100000 }
    };
    expect(() => normalizeJobExtraction(invalid)).toThrow(ValidationError);
  });
  
  it('rejects negative experience', () => {
    const invalid = { ...validCandidate, experience: { minYears: -1 } };
    expect(() => normalizeJobExtraction(invalid)).toThrow(ValidationError);
  });
});
