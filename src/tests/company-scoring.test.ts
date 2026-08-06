import { describe, it, expect } from 'vitest';
import { calculateCompanyScores, calculateOpportunityV2, calculateApplicationPriority } from '../lib/company/scoring.js';
import type { CompanyResearch } from '../lib/company/schema.js';

describe('Company Scoring Determinism', () => {
  const baseResearch: CompanyResearch = {
    company: { name: 'Acme Corp', officialWebsite: 'https://acme.com' },
    companyProfile: { employeeCountMin: 50 },
    hiring: { currentOpenings: 10, engineeringOpenings: 3, remoteOpenings: 2 },
    signals: {
      expansionSignals: [{ type: 'FACT', description: 'New office opened' }],
      contractionSignals: [],
      remoteSignals: [{ type: 'FACT', description: 'Remote friendly' }],
      stabilitySignals: [{ type: 'FACT', description: '5 years of steady growth' }]
    },
    funding: null,
    layoffs: null,
    sources: [{ url: 'https://acme.com', type: 'OFFICIAL_WEBSITE' }]
  };

  it('calculates deterministic scores for identical inputs', () => {
    const run1 = calculateCompanyScores(baseResearch);
    const run2 = calculateCompanyScores(baseResearch);
    
    expect(run1.companyScore).toBe(run2.companyScore);
    expect(run1.hiringMomentum).toBe(run2.hiringMomentum);
    expect(run1.confidence).toBe(run2.confidence);
  });

  it('reduces score for contraction and layoffs', () => {
    const badResearch = {
      ...baseResearch,
      signals: {
        ...baseResearch.signals,
        contractionSignals: [{ type: 'FACT', description: 'Hiring freeze' } as any]
      },
      layoffs: {
        recentLayoffEvidence: [{ type: 'FACT', description: '10% laid off' } as any]
      }
    };
    
    const baseScores = calculateCompanyScores(baseResearch);
    const badScores = calculateCompanyScores(badResearch);

    expect(badScores.companyScore).toBeLessThan(baseScores.companyScore);
    expect(badScores.hiringMomentum).toBeLessThan(baseScores.hiringMomentum);
  });

  it('handles null/missing research gracefully', () => {
    const scores = calculateCompanyScores(null);
    expect(scores.companyScore).toBe(50);
    expect(scores.hiringMomentum).toBe(50);
    expect(scores.confidence).toBe(0.2); // Base confidence
  });

  it('Opportunity V2 cannot rescue a hard filtered (SKIP) job if V1 < 50', () => {
    const oppV1 = 45; // SKIP
    const compScore = 100; // Perfect company
    const momentum = 100; // Perfect momentum
    
    const v2 = calculateOpportunityV2(oppV1, compScore, momentum);
    expect(v2).toBeLessThan(50); // MUST NOT cross to CONSIDER (50+)
  });
});
