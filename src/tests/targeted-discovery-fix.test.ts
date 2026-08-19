import { expect, describe, it } from 'vitest';
import { SearchEngineProvider } from '../lib/discovery/providers/SearchEngineProvider';
import { validateOriginalJobUrl } from '../lib/jobs/url-validator';
import { normalizeJobExtraction } from '../lib/jobs/normalize';
import { StealthStrategy } from '../lib/discovery/strategy/strategies';
import { DefaultStrategy } from '../lib/discovery/strategy/strategies';
import type { CandidateJob } from '../lib/jobs/extractionSchema';

describe('Targeted Discovery Fixes', () => {

  describe('Task A: SearchEngineProvider prompt contract', () => {
    it('requires exact job URLs in the AGY prompt', async () => {
      // We can intercept or spy on runAgyUnstructured, but an easier way is to just call the private build prompt logic if it were exposed.
      // Since it's inside the async discover method and runs agy, we can't easily execute it without mocking.
      // However, we can assert that the string literal exists in the file (using a simple fs check for the test).
      const fs = await import('fs/promises');
      const content = await fs.readFile('src/lib/discovery/providers/SearchEngineProvider.ts', 'utf8');
      
      expect(content).toContain('Return only concrete job posting URLs');
      expect(content).toContain('Never replace them with ATS root domains');
      expect(content).toContain('No Markdown, no bullets');
      expect(content).toContain('Return one URL per line');
    });
  });

  describe('Task B & C: URL Validation and Provenance Preservation', () => {
    
    const validCandidateBase = {
      company: { name: 'Acme Corp' },
      job: { title: 'Software Engineer' }
    } as any;

    it('allows a concrete ATS job URL to survive normalization', () => {
      const candidate: CandidateJob = {
        ...validCandidateBase,
        job: { title: 'Software Engineer', url: 'https://boards.greenhouse.io/acmecorp/jobs/12345' }
      };
      const normalized = normalizeJobExtraction(candidate);
      expect(normalized.job.url).toBe('https://boards.greenhouse.io/acmecorp/jobs/12345');
    });

    it('rejects a generic ATS root URL', () => {
      const candidate: CandidateJob = {
        ...validCandidateBase,
        job: { title: 'Software Engineer', url: 'https://boards.greenhouse.io' }
      };
      expect(() => normalizeJobExtraction(candidate)).toThrow('Generic company homepage or careers landing page rejected');
    });

    it('rejects missing URL and does not convert to "/"', () => {
      const candidateMissing: CandidateJob = {
        ...validCandidateBase,
        job: { title: 'Software Engineer' }
      };
      // Expect missing URL to throw validation error about missing URL, not a malformed/slash error.
      expect(() => normalizeJobExtraction(candidateMissing)).toThrow('URL is missing or empty');
      
      const candidateEmpty: CandidateJob = {
        ...validCandidateBase,
        job: { title: 'Software Engineer', url: '' }
      };
      expect(() => normalizeJobExtraction(candidateEmpty)).toThrow('URL is missing or empty');
    });
  });

  describe('Task D: Hunt Runtime Authoritative', () => {
    it('StealthStrategy uses Hunt-configured maximumRuntime', () => {
      const strategy = new StealthStrategy();
      
      // Without config, it should fallback to defaults
      const defaultConfig = strategy.getConfiguration();
      expect(defaultConfig.maxBudgetMs).toBe(120000);

      // With config, it should prioritize Hunt config
      const customConfig = strategy.getConfiguration({ maximumRuntime: 600000, maximumUsableResults: 20 });
      expect(customConfig.maxBudgetMs).toBe(600000);
      expect(customConfig.maxProviderRuntimeMs).toBe(600000);
      expect(customConfig.maxUsableOpportunities).toBe(20);
    });

    it('DefaultStrategy uses Hunt-configured maximumRuntime', () => {
      const strategy = new DefaultStrategy();
      
      const customConfig = strategy.getConfiguration({ maximumRuntime: 300000, maximumUsableResults: 10 });
      expect(customConfig.maxBudgetMs).toBe(300000);
      expect(customConfig.maxProviderRuntimeMs).toBe(300000);
      expect(customConfig.maxUsableOpportunities).toBe(10);
    });
  });

});
