import type { BaseSignalProvider, FoundationContext, ObservableSignal } from '../interfaces';
import type { SignalCategory, SignalType } from '../types';

export class SalaryMinProvider implements BaseSignalProvider {
  type: SignalType = 'SALARY_MIN';
  category: SignalCategory = 'SALARY';
  
  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.salaryMin != null) {
      return {
        type: this.type,
        value: context.job.salaryMin,
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

export class SalaryMaxProvider implements BaseSignalProvider {
  type: SignalType = 'SALARY_MAX';
  category: SignalCategory = 'SALARY';
  
  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.salaryMax != null) {
      return {
        type: this.type,
        value: context.job.salaryMax,
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

export class RemotePolicyProvider implements BaseSignalProvider {
  type: SignalType = 'REMOTE_POLICY';
  category: SignalCategory = 'REMOTE';

  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.remoteType) {
      return {
        type: this.type,
        value: context.job.remoteType,
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

export class ExperienceMatchProvider implements BaseSignalProvider {
  type: SignalType = 'EXPERIENCE_MATCH';
  category: SignalCategory = 'REQUIREMENTS';

  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.experienceMin != null) {
      return {
        type: this.type,
        value: {
          min: context.job.experienceMin,
          max: context.job.experienceMax
        },
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

// Add remaining providers (EmploymentType, Location, DirectCareersPage, etc.)
export class EmploymentTypeProvider implements BaseSignalProvider {
  type: SignalType = 'EMPLOYMENT_TYPE';
  category: SignalCategory = 'REQUIREMENTS';

  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.employmentType) {
      return {
        type: this.type,
        value: context.job.employmentType,
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

export class LocationMatchProvider implements BaseSignalProvider {
  type: SignalType = 'LOCATION_MATCH';
  category: SignalCategory = 'REQUIREMENTS';

  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.location) {
      return {
        type: this.type,
        value: context.job.location,
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

export class PostingFreshnessProvider implements BaseSignalProvider {
  type: SignalType = 'POSTING_FRESHNESS';
  category: SignalCategory = 'COMPANY';

  async extractSignal(context: FoundationContext): Promise<ObservableSignal | null> {
    if (context.job.firstSeenAt) {
      const daysOld = Math.floor((new Date().getTime() - new Date(context.job.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24));
      return {
        type: this.type,
        value: daysOld,
        metadata: { source: 'job_record', timestamp: new Date().toISOString() }
      };
    }
    return null;
  }
}

export function registerDefaultProviders(registry: any) {
  registry.register(new SalaryMinProvider());
  registry.register(new SalaryMaxProvider());
  registry.register(new RemotePolicyProvider());
  registry.register(new ExperienceMatchProvider());
  registry.register(new EmploymentTypeProvider());
  registry.register(new LocationMatchProvider());
  registry.register(new PostingFreshnessProvider());
}
