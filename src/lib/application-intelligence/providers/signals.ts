import type { BaseApplicationIntelligenceProvider, ApplicationIntelligenceContext, ApplicationIntelligenceSignal } from '../interfaces';
import type { ApplicationSignalType } from '../types';

export class QualificationMatchProvider implements BaseApplicationIntelligenceProvider {
  type: ApplicationSignalType = 'QUALIFICATION_MATCH';

  async extractSignal(context: ApplicationIntelligenceContext): Promise<ApplicationIntelligenceSignal | null> {
    if (context.qualificationScore === undefined) return null;

    let weight = 0;
    if (context.qualificationScore >= 80) weight = 30;
    else if (context.qualificationScore >= 60) weight = 15;
    else if (context.qualificationScore < 40) weight = -20;

    return {
      type: this.type,
      value: context.qualificationScore,
      weight,
      metadata: { description: 'Base qualification score alignment' }
    };
  }
}

export class MissingSkillsProvider implements BaseApplicationIntelligenceProvider {
  type: ApplicationSignalType = 'SKILL_MATCH';

  async extractSignal(context: ApplicationIntelligenceContext): Promise<ApplicationIntelligenceSignal | null> {
    if (!context.qualificationSkills || !context.candidateProfile) return null;

    const candidateSkills = new Set((context.candidateProfile.skills || []).map(s => s.toLowerCase()));
    const missing = context.qualificationSkills.filter(s => !candidateSkills.has(s.toLowerCase()));

    let weight = 0;
    if (missing.length === 0) weight = 15;
    else if (missing.length > 3) weight = -15;
    else weight = -5; // 1-3 missing skills

    return {
      type: this.type,
      value: missing,
      weight,
      metadata: { missingCount: missing.length, missingSkills: missing }
    };
  }
}

export class CompetitionScoreProvider implements BaseApplicationIntelligenceProvider {
  type: ApplicationSignalType = 'COMPETITION_SCORE';

  async extractSignal(context: ApplicationIntelligenceContext): Promise<ApplicationIntelligenceSignal | null> {
    if (!context.competitionResult) return null;

    const score = context.competitionResult.score;
    let weight = 0;

    if (score < 30) weight = 20; // Low competition -> highly actionable
    else if (score > 70) weight = -10; // High competition -> requires stronger match

    return {
      type: this.type,
      value: score,
      weight,
      metadata: { level: context.competitionResult.level }
    };
  }
}

export class CompanyOpportunityProvider implements BaseApplicationIntelligenceProvider {
  type: ApplicationSignalType = 'COMPANY_OPPORTUNITY';

  async extractSignal(context: ApplicationIntelligenceContext): Promise<ApplicationIntelligenceSignal | null> {
    if (!context.companyOpportunityResult) return null;

    const score = context.companyOpportunityResult.score;
    let weight = 0;

    if (score >= 80) weight = 15;
    else if (score < 40) weight = -15;

    return {
      type: this.type,
      value: score,
      weight,
      metadata: { level: context.companyOpportunityResult.level }
    };
  }
}

export class DiscoveryIntelligenceProvider implements BaseApplicationIntelligenceProvider {
  type: ApplicationSignalType = 'DISCOVERY_INTELLIGENCE';

  async extractSignal(context: ApplicationIntelligenceContext): Promise<ApplicationIntelligenceSignal | null> {
    if (!context.discoveryIntelligenceOutput) return null;

    const score = context.discoveryIntelligenceOutput.result.score;
    let weight = 0;

    if (score >= 70) weight = 10;
    else if (score < 30) weight = -5;

    return {
      type: this.type,
      value: score,
      weight,
      metadata: { level: context.discoveryIntelligenceOutput.result.level }
    };
  }
}

export function registerDefaultProviders(registry: any) {
  registry.register(new QualificationMatchProvider());
  registry.register(new MissingSkillsProvider());
  registry.register(new CompetitionScoreProvider());
  registry.register(new CompanyOpportunityProvider());
  registry.register(new DiscoveryIntelligenceProvider());
}
