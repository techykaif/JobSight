import { describe, it, expect, beforeEach } from 'vitest';
import { applicationIntelligenceRegistry } from '../lib/application-intelligence/registry';
import { runApplicationIntelligence } from '../lib/application-intelligence/engine';
import type { ApplicationIntelligenceContext } from '../lib/application-intelligence/interfaces';
import { registerDefaultProviders } from '../lib/application-intelligence/providers/signals';

describe('Application Intelligence Engine', () => {
  beforeEach(() => {
    applicationIntelligenceRegistry.clear();
    registerDefaultProviders(applicationIntelligenceRegistry);
  });

  it('should register core providers correctly', () => {
    const providers = applicationIntelligenceRegistry.getProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some(p => p.type === 'QUALIFICATION_MATCH')).toBe(true);
    expect(providers.some(p => p.type === 'SKILL_MATCH')).toBe(true);
  });

  it('should recommend Apply Immediately for a perfect candidate', async () => {
    const ctx: ApplicationIntelligenceContext = {
      runId: 'test-run',
      job: { id: 'job-1' } as any,
      qualificationScore: 90, // +30
      candidateProfile: { skills: ['React', 'TypeScript', 'Node.js'] } as any,
      qualificationSkills: ['react', 'typescript'], // Missing 0 -> +15
      competitionResult: { score: 20, level: 'Low' } as any, // +20
      companyOpportunityResult: { score: 85, level: 'Exceptional' } as any, // +15
      discoveryIntelligenceOutput: { result: { score: 80, level: 'Exceptional', confidence: 90 } } as any // +10
    };

    const result = await runApplicationIntelligence(ctx);

    // Score checks
    // Base 50 + 30 + 15 + 20 + 15 + 10 = 140 -> capped at 100
    expect(result.result.score).toBe(100); 
    expect(result.result.readinessLevel).toBe('Ready Now');
    
    // Summary checks
    expect(result.summary.strengths).toContain('Strong Qualification Match');
    expect(result.summary.strengths).toContain('All Required Skills Met');
    
    // Recommendation
    expect(result.recommendation).toBe('Apply Immediately');
  });

  it('should recommend Upskill Before Applying for missing multiple skills and weak score', async () => {
    const ctx: ApplicationIntelligenceContext = {
      runId: 'test-run',
      job: { id: 'job-2' } as any,
      qualificationScore: 35, // -20
      candidateProfile: { skills: ['HTML'] } as any,
      qualificationSkills: ['react', 'typescript', 'node.js', 'docker'], // Missing 4 -> -15
      competitionResult: { score: 80, level: 'High' } as any, // -10
      companyOpportunityResult: { score: 30, level: 'Poor' } as any, // -15
      discoveryIntelligenceOutput: { result: { score: 20, level: 'Weak', confidence: 90 } } as any // -5
    };

    const result = await runApplicationIntelligence(ctx);

    // Score checks
    // Base 50 - 20 - 15 - 10 - 15 - 5 = -15 -> capped at 0
    expect(result.result.score).toBe(0); 
    expect(result.result.readinessLevel).toBe('Not Recommended');
    
    // Summary checks
    expect(result.summary.weaknesses).toContain('Weak Qualification Match');
    expect(result.summary.weaknesses).toContain('Missing Multiple Key Skills');
    
    // Recommendation
    expect(result.recommendation).toBe('Skip Application');
  });

  it('should recommend Customize Resume First for missing some skills and ok match', async () => {
    const ctx: ApplicationIntelligenceContext = {
      runId: 'test-run',
      job: { id: 'job-3' } as any,
      qualificationScore: 65, // +15
      candidateProfile: { skills: ['React', 'TypeScript'] } as any,
      qualificationSkills: ['react', 'typescript', 'aws'], // Missing 1 -> -5
      competitionResult: { score: 50, level: 'Medium' } as any, // 0
      companyOpportunityResult: { score: 60, level: 'Standard' } as any, // 0
      discoveryIntelligenceOutput: { result: { score: 50, level: 'Standard', confidence: 90 } } as any // 0
    };

    const result = await runApplicationIntelligence(ctx);

    // Score checks
    // Base 50 + 15 - 5 = 60
    expect(result.result.score).toBe(60); 
    expect(result.result.readinessLevel).toBe('Almost Ready');
    
    // Summary checks
    expect(result.summary.strengths).toContain('Strong Qualification Match');
    expect(result.summary.weaknesses).toContain('Missing Some Preferred Skills');
    
    // Recommendation
    expect(result.recommendation).toBe('Customize Resume First');
  });
});
