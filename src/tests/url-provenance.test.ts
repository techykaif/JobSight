import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateOriginalJobUrl, UrlValidationError } from '../lib/jobs/url-validator.js';
import { normalizeUrl } from '../lib/jobs/persist.js';
import { normalizeJobExtraction } from '../lib/jobs/normalize.js';
import { db } from '../lib/db/client.js';
import * as schema from '../lib/db/schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { persistCandidateJob } from '../lib/jobs/persist.js';

describe('D1.7.1-H1 URL Provenance & Integrity', () => {
  beforeEach(async () => {
    migrate(db, { migrationsFolder: './src/lib/db/migrations' });
    await db.delete(schema.jobObservations);
    await db.delete(schema.jobs);
    await db.delete(schema.companies);
    await db.delete(schema.runs);
    await db.delete(schema.huntConfigs);
  });

  describe('Strict URL Validation', () => {
    it('1. valid HTTPS job URL passes', () => {
      expect(validateOriginalJobUrl('https://example.com/jobs/123')).toBe('https://example.com/jobs/123');
    });

    it('2. valid HTTP job URL passes', () => {
      expect(validateOriginalJobUrl('http://example.com/careers/engineer')).toBe('http://example.com/careers/engineer');
    });

    it('3. missing URL fails', () => {
      expect(() => validateOriginalJobUrl(undefined)).toThrowError(UrlValidationError);
    });

    it('4. null URL fails', () => {
      expect(() => validateOriginalJobUrl(null as any)).toThrowError(UrlValidationError);
    });

    it('5. empty URL fails', () => {
      expect(() => validateOriginalJobUrl('')).toThrowError(UrlValidationError);
    });

    it('6. whitespace URL fails', () => {
      expect(() => validateOriginalJobUrl('   ')).toThrowError(UrlValidationError);
    });

    it('7. relative URL fails', () => {
      expect(() => validateOriginalJobUrl('/jobs/123')).toThrowError(UrlValidationError);
    });

    it('8. malformed URL fails', () => {
      expect(() => validateOriginalJobUrl('https:// malformed .com')).toThrowError(UrlValidationError);
    });

    it('9. javascript URL fails', () => {
      expect(() => validateOriginalJobUrl('javascript:alert(1)')).toThrowError(UrlValidationError);
    });

    it('10. data URL fails', () => {
      expect(() => validateOriginalJobUrl('data:text/plain;base64,SGVsbG8=')).toThrowError(UrlValidationError);
    });

    it('11. file URL fails', () => {
      expect(() => validateOriginalJobUrl('file:///etc/passwd')).toThrowError(UrlValidationError);
    });

    it('12. JobSight internal URL fails', () => {
      expect(() => validateOriginalJobUrl('https://jobsight.app/jobs/123')).toThrowError(UrlValidationError);
      expect(() => validateOriginalJobUrl('http://localhost:3000/jobs/123')).toThrowError(UrlValidationError);
    });

    it('13. obvious search-engine URL fails', () => {
      expect(() => validateOriginalJobUrl('https://google.com/search?q=jobs')).toThrowError(UrlValidationError);
      expect(() => validateOriginalJobUrl('https://www.bing.com/jobs')).toThrowError(UrlValidationError);
    });

    it('14. obvious search-result URL fails', () => {
      expect(() => validateOriginalJobUrl('https://duckduckgo.com/?q=engineer+jobs')).toThrowError(UrlValidationError);
    });

    it('15. generic company homepage fails', () => {
      expect(() => validateOriginalJobUrl('https://company.com')).toThrowError(UrlValidationError);
      expect(() => validateOriginalJobUrl('https://company.com/')).toThrowError(UrlValidationError);
    });

    it('16. generic company careers landing page fails', () => {
      expect(() => validateOriginalJobUrl('https://company.com/careers')).toThrowError(UrlValidationError);
      expect(() => validateOriginalJobUrl('https://company.com/jobs/')).toThrowError(UrlValidationError);
    });

    it('17. specific company job path passes', () => {
      expect(validateOriginalJobUrl('https://company.com/careers/software-engineer')).toBe('https://company.com/careers/software-engineer');
      expect(validateOriginalJobUrl('https://company.com/jobs/view/123')).toBe('https://company.com/jobs/view/123');
    });

    it('18. specific job-board posting URL passes if it represents the actual posting', () => {
      // Third party job board actual job listing is allowed (since it's an actual specific job path)
      expect(validateOriginalJobUrl('https://boards.greenhouse.io/company/jobs/123')).toBe('https://boards.greenhouse.io/company/jobs/123');
    });
  });

  describe('AGY Boundary & Persistence', () => {
    it('19. AGY candidate without URL fails persistence', () => {
      const candidate: any = { company: { name: 'Comp' }, job: { title: 'Engineer', status: 'ACTIVE' } };
      expect(() => normalizeJobExtraction(candidate)).toThrow(/Invalid job url/);
    });

    it('20. AGY candidate with invalid URL fails persistence', () => {
      const candidate: any = { company: { name: 'Comp' }, job: { title: 'Engineer', url: 'https://google.com', status: 'ACTIVE' } };
      expect(() => normalizeJobExtraction(candidate)).toThrow(/Invalid job url/);
    });

    it('21. unmatched AGY URL does NOT receive fabricated Stage A provenance', () => {
      // This is handled in ingestion.ts. Just asserting the normalizer doesn't invent sources.
      const candidate: any = { company: { name: 'Comp' }, job: { title: 'Engineer', url: 'https://company.com/jobs/123', status: 'ACTIVE' } };
      const normalized = normalizeJobExtraction(candidate);
      expect(normalized.sources).toBeUndefined();
    });

    it('22. exact Stage A URL match preserves Stage A provenance', () => {
      // Emulating what ingestion.ts does
      const candidate: any = { company: { name: 'Comp' }, job: { title: 'Engineer', url: 'https://company.com/jobs/123', status: 'ACTIVE' } };
      candidate.sources = [{ url: 'https://company.com/jobs/123', type: 'SEARCH_RESULT' }];
      const normalized = normalizeJobExtraction(candidate);
      expect(normalized.sources?.[0]?.type).toBe('SEARCH_RESULT');
    });
  });

  describe('Normalization & DB Constraints', () => {
    it('24. existing valid job update cannot erase canonicalUrl', async () => {
      const now = new Date().toISOString();
      await db.insert(schema.huntConfigs).values({ id: 'conf1', targetRoles: ['Engineer'], alternativeRoles: [], createdAt: now, updatedAt: now });
      await db.insert(schema.runs).values([{ id: 'run1', configId: 'conf1', status: 'COMPLETED', createdAt: now, updatedAt: now }, { id: 'run2', configId: 'conf1', status: 'COMPLETED', createdAt: now, updatedAt: now }]);
      
      const candidate: any = {
        company: { name: 'Test Comp', website: 'https://test.com', careersUrl: 'https://test.com/careers' },
        job: { title: 'Engineer', url: 'https://company.com/jobs/123', status: 'ACTIVE', location: 'Remote', remoteType: 'REMOTE', employmentType: 'FULL_TIME' }
      };
      const normalized = normalizeJobExtraction(candidate);
      await persistCandidateJob('run1', normalized);
      
      const jobs = await db.select().from(schema.jobs);
      expect(jobs.length).toBe(1);
      expect(jobs[0]?.canonicalUrl).toBe('https://company.com/jobs/123');

      // Subsequent update should retain canonicalUrl
      await persistCandidateJob('run2', normalized);
      const jobs2 = await db.select().from(schema.jobs);
      expect(jobs2.length).toBe(1); // Deduped
      expect(jobs2[0]?.canonicalUrl).toBe('https://company.com/jobs/123'); // Not lost
    });

    it('25. duplicate valid canonical URLs still deduplicate correctly', async () => {
      const now = new Date().toISOString();
      await db.insert(schema.huntConfigs).values({ id: 'conf2', targetRoles: ['Engineer'], alternativeRoles: [], createdAt: now, updatedAt: now });
      await db.insert(schema.runs).values([{ id: 'run3', configId: 'conf2', status: 'COMPLETED', createdAt: now, updatedAt: now }, { id: 'run4', configId: 'conf2', status: 'COMPLETED', createdAt: now, updatedAt: now }]);
      
      const candidate1: any = { company: { name: 'Test Comp', website: 'https://test.com', careersUrl: 'https://test.com/careers' }, job: { title: 'Engineer 1', url: 'https://company.com/jobs/123', status: 'ACTIVE', location: 'Remote', remoteType: 'REMOTE', employmentType: 'FULL_TIME' } };
      const candidate2: any = { company: { name: 'Test Comp', website: 'https://test.com', careersUrl: 'https://test.com/careers' }, job: { title: 'Engineer 2', url: 'https://company.com/jobs/123', status: 'ACTIVE', location: 'Remote', remoteType: 'REMOTE', employmentType: 'FULL_TIME' } };
      
      await persistCandidateJob('run3', normalizeJobExtraction(candidate1));
      await persistCandidateJob('run4', normalizeJobExtraction(candidate2));
      
      const jobs = await db.select().from(schema.jobs);
      expect(jobs.length).toBe(1);
      expect(jobs[0]?.canonicalTitle).toBe('Engineer 2'); // Updated
    });
  });
});
