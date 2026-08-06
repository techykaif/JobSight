import { describe, it, expect } from 'vitest';
import { CompanyResearchSchema } from '../lib/company/schema.js';

describe('Company Research Hallucination / Null handling', () => {
  it('allows structured data without funding, layoffs, or employee counts', () => {
    const rawResearch = {
      company: { name: 'Startup Inc' },
      companyProfile: { 
        employeeCountMin: null,
        employeeCountMax: null,
        stage: null,
        foundedYear: null
      },
      hiring: { 
        currentOpenings: null,
        engineeringOpenings: null,
        remoteOpenings: null,
        recent30dPostings: null,
        recent90dPostings: null
      },
      signals: {
        expansionSignals: [],
        contractionSignals: [],
        remoteSignals: [],
        stabilitySignals: []
      },
      funding: null,
      layoffs: null,
      sources: [{ url: 'https://startup.com', type: 'OFFICIAL_WEBSITE' }]
    };

    // Zod validation should succeed without inventing values
    const parsed = CompanyResearchSchema.parse(rawResearch);
    
    expect(parsed.funding).toBeNull();
    expect(parsed.layoffs).toBeNull();
    expect(parsed.companyProfile.employeeCountMin).toBeNull();
  });
});
