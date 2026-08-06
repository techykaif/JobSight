import { describe, it, expect } from 'vitest';
import { calculateScores } from '../lib/qualification/scoring.js';
import { M5CandidateFixture } from '../fixtures/candidate-profile.js';

describe('Extreme Experience Gap Gating', () => {
  const baseJob = {
    remoteType: 'REMOTE',
    salaryMin: 100000,
    salaryMax: 150000,
    location: 'Remote',
  };

  const perfectSkillMatch = {
    requiredTotal: 3, requiredMatched: 3,
    preferredTotal: 2, preferredMatched: 2
  };

  const createAnalysis = (strictness: 'HARD' | 'MODERATE' | 'FLEXIBLE' | 'UNKNOWN') => ({
    experienceStrictness: strictness,
    actualSeniority: 'SENIOR' as any,
    responsibilityComplexity: 'HIGH' as any,
    portfolioExperienceRelevant: true,
    majorBlockers: [],
    positiveSignals: [],
    reasoning: [],
    confidence: 0.9
  });

  const getProfile = (years: number) => ({
    ...M5CandidateFixture,
    yearsOfProfessionalExperience: years,
    salaryExpectations: { minimum: 50000, preferred: 80000, currency: 'USD' },
    remotePreference: 'REMOTE_ONLY' as any
  });

  it('caps opportunity score for 0 vs HARD 5+', async () => {
    const scores = await calculateScores(
      { ...baseJob, experienceMin: 5 },
      {},
      getProfile(0),
      createAnalysis('HARD'),
      perfectSkillMatch
    );
    expect(scores.opportunity).toBeLessThan(50); // Should be capped at 49 or less
  });

  it('caps opportunity score for 1 vs HARD 7+', async () => {
    const scores = await calculateScores(
      { ...baseJob, experienceMin: 7 },
      {},
      getProfile(1),
      createAnalysis('HARD'),
      perfectSkillMatch
    );
    expect(scores.opportunity).toBeLessThan(50);
  });

  it('caps opportunity score for 2 vs HARD 8+', async () => {
    const scores = await calculateScores(
      { ...baseJob, experienceMin: 8 },
      {},
      getProfile(2),
      createAnalysis('HARD'),
      perfectSkillMatch
    );
    expect(scores.opportunity).toBeLessThan(50);
  });

  it('does NOT cap opportunity score for 0 vs FLEXIBLE 2 (diff=2)', async () => {
    const scores = await calculateScores(
      { ...baseJob, experienceMin: 2 },
      {},
      getProfile(0),
      createAnalysis('FLEXIBLE'),
      perfectSkillMatch
    );
    expect(scores.opportunity).toBeGreaterThanOrEqual(50); // Just normal penalties
  });

  it('does NOT cap opportunity score for 1 vs MODERATE 3 (diff=2)', async () => {
    const scores = await calculateScores(
      { ...baseJob, experienceMin: 3 },
      {},
      getProfile(1),
      createAnalysis('MODERATE'),
      perfectSkillMatch
    );
    expect(scores.opportunity).toBeGreaterThanOrEqual(50); // Just normal penalties
  });
});
