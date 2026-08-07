import type { BaseCompanyOpportunityProvider, CompanyOpportunityContext, CompanyOpportunitySignal } from '../interfaces';
import type { CompanySignalType } from '../types';

export class NumberOfActiveRolesProvider implements BaseCompanyOpportunityProvider {
  type: CompanySignalType = 'NUMBER_OF_ACTIVE_ROLES';

  async extractSignal(context: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null> {
    const activeRoles = context.jobsForCompany.length;
    let weight = 0;
    if (activeRoles > 10) weight = 20;
    else if (activeRoles > 3) weight = 10;
    else if (activeRoles === 1) weight = 5;

    return {
      type: this.type,
      value: activeRoles,
      weight,
      metadata: { source: 'jobs' }
    };
  }
}

export class EngineeringHiringProvider implements BaseCompanyOpportunityProvider {
  type: CompanySignalType = 'ENGINEERING_HIRING';

  async extractSignal(context: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null> {
    const engRoles = context.jobsForCompany.filter(j => 
      j.canonicalTitle?.toLowerCase().includes('engineer') || 
      j.canonicalTitle?.toLowerCase().includes('developer')
    ).length;

    if (engRoles > 0) {
      return {
        type: this.type,
        value: engRoles,
        weight: engRoles > 3 ? 15 : 5,
        metadata: { source: 'jobs' }
      };
    }
    return null;
  }
}

export class RemoteHiringProvider implements BaseCompanyOpportunityProvider {
  type: CompanySignalType = 'REMOTE_HIRING';

  async extractSignal(context: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null> {
    let remoteCount = 0;
    for (const job of context.jobsForCompany) {
      const signals = context.foundationSignalsByJob[job.id] || [];
      if (signals.some(s => s.type === 'REMOTE_POLICY' && ['REMOTE', 'WORLDWIDE_REMOTE'].includes(s.value))) {
        remoteCount++;
      }
    }

    if (remoteCount > 0) {
      return {
        type: this.type,
        value: remoteCount,
        weight: remoteCount > 2 ? 15 : 5,
        metadata: { source: 'foundation' }
      };
    }
    return null;
  }
}

export class PostingFreshnessProvider implements BaseCompanyOpportunityProvider {
  type: CompanySignalType = 'POSTING_FRESHNESS';

  async extractSignal(context: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null> {
    let freshCount = 0;
    for (const job of context.jobsForCompany) {
      const signals = context.foundationSignalsByJob[job.id] || [];
      const freshness = signals.find(s => s.type === 'POSTING_FRESHNESS');
      if (freshness && typeof freshness.value === 'number' && freshness.value <= 7) {
        freshCount++;
      }
    }

    if (freshCount > 0) {
      return {
        type: this.type,
        value: freshCount,
        weight: freshCount > 2 ? 20 : 10,
        metadata: { source: 'foundation' }
      };
    }
    return null;
  }
}

export class CompetitionScoreProvider implements BaseCompanyOpportunityProvider {
  type: CompanySignalType = 'COMPETITION_SCORE';

  async extractSignal(context: CompanyOpportunityContext): Promise<CompanyOpportunitySignal | null> {
    let totalScore = 0;
    let count = 0;
    for (const job of context.jobsForCompany) {
      const comp = context.competitionResultsByJob[job.id];
      if (comp) {
        totalScore += comp.score;
        count++;
      }
    }

    if (count > 0) {
      const avgScore = Math.round(totalScore / count);
      // Lower competition across the company means it's a better opportunity to stand out
      let weight = 0;
      if (avgScore <= 30) weight = 15;
      else if (avgScore >= 70) weight = -10;

      return {
        type: this.type,
        value: avgScore,
        weight,
        metadata: { source: 'competition' }
      };
    }
    return null;
  }
}

export function registerDefaultProviders(registry: any) {
  registry.register(new NumberOfActiveRolesProvider());
  registry.register(new EngineeringHiringProvider());
  registry.register(new RemoteHiringProvider());
  registry.register(new PostingFreshnessProvider());
  registry.register(new CompetitionScoreProvider());
}
