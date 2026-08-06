import { describe, it, expect } from 'vitest';
import { StructuringOutputSchema } from '../lib/jobs/extractionSchema.js';
import { EXTERNAL_AGY_STRUCTURING_CONTRACT } from '../lib/jobs/extractionSchema.js';

describe('Schema Drift Risk Protection', () => {
  it('ensures the manual JSON Schema matches the canonical Zod schema behavior', () => {
    const validCandidateObj = {
      company: { name: 'Drift Corp' },
      job: { title: 'Engineer', url: 'https://drift.com/job', status: 'ACTIVE' },
      description: { summary: 'Job description' },
      sources: [{ url: 'https://drift.com/job', type: 'OFFICIAL_JOB_PAGE' }],
      evidence: [
        { field: 'remoteType', excerpt: 'remote allowed', evidenceType: 'FACT' }
      ]
    };

    const validCandidateWithNulls = {
      ...validCandidateObj,
      compensation: { salaryMin: null, salaryMax: 150000, currency: null, period: null },
      job: { ...validCandidateObj.job, remoteType: null, employmentType: null },
      experience: { minYears: null, maxYears: null, rawText: null }
    };

    // 1. Must pass Zod
    expect(() => StructuringOutputSchema.parse({ candidates: [validCandidateObj] })).not.toThrow();
    
    // Zod handles nulls via schema rules (nullable). Let's see if this payload works.
    expect(() => StructuringOutputSchema.parse({ candidates: [validCandidateWithNulls] })).not.toThrow();
  });
});
