import { describe, it, expect } from 'vitest';
import { evaluateGeographicEligibility } from '../lib/geographic-eligibility/evaluator';
import { CandidateJobSchema } from '../lib/jobs/extractionSchema';
import { normalizeJobExtraction } from '../lib/jobs/normalize';

describe('B6 Authority Boundary Integration', () => {
  it('proves B6 is authoritative over the legacy LLM-generated value', () => {
    // 1. Simulate the candidate as structured by AGY (LLM)
    const candidateRaw: any = {
      company: { name: 'Authority Corp' },
      job: {
        title: 'Software Engineer',
        url: 'https://test.com/job',
        status: 'ACTIVE',
        location: 'Colombia, Argentina, Brazil', // LLM extracts geographic constraints
        remoteType: 'REMOTE',
        candidateRemoteEligibility: 'ELIGIBLE' // LLM incorrectly guesses ELIGIBLE
      }
    };

    // Safeparse (as happens before the B6 logic in ingestion)
    const candidate = CandidateJobSchema.parse(candidateRaw);

    // Verify LLM's claim is loaded
    expect(candidate.job.candidateRemoteEligibility).toBe('ELIGIBLE');

    // 2. Execute B6 logic (as it runs in ingestion.ts)
    const config = { candidateCountry: 'India' };

    const b6Result = evaluateGeographicEligibility(
      candidate.job.location,
      candidate.description?.summary,
      candidate.job.remoteType,
      config.candidateCountry
    );

    // Evaluator correctly identifies mismatch
    expect(b6Result.eligibilityStatus).toBe('NOT_ELIGIBLE');

    // 3. Mutate the candidate exactly as ingestion.ts does
    candidate.job.candidateRemoteEligibility = b6Result.eligibilityStatus === 'NEEDS_VERIFICATION' ? 'UNKNOWN' : b6Result.eligibilityStatus;
    candidate.job.geographicRemoteScope = b6Result.remoteScope;
    candidate.job.geographicEligibilityReason = b6Result.eligibilityReason;
    candidate.job.geographicEligibilityConfidence = b6Result.eligibilityConfidence;

    // 4. Normalize the final candidate
    const normalized = normalizeJobExtraction(candidate);

    // 5. Final assertion: the candidate object now holds the B6 truth, not the LLM guess
    expect(normalized.job.candidateRemoteEligibility).toBe('NOT_ELIGIBLE');
    expect(normalized.job.geographicRemoteScope).toBe('COUNTRY_SPECIFIC');
  });
});
