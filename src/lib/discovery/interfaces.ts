export type ProviderType = 'SEARCH_ENGINE' | 'CAREERS_PAGE' | 'GREENHOUSE' | 'LEVER' | 'ASHBY' | 'WORKDAY' | 'RSS' | 'SITEMAP' | 'CUSTOM';

export interface ProviderCapabilities {
  supportsSearch: boolean;
  supportsPagination: boolean;
  supportsRemoteFiltering: boolean;
  supportsSalaryExtraction: boolean;
  supportsAuthentication: boolean;
  supportsIncrementalSync: boolean;
  supportsHistoricalLookup: boolean;
  supportsCompanyMetadata: boolean;
  supportsJobMetadata: boolean;
}

export interface DiscoveryContext {
  runId: string;
  sourceUrl: string;
  targetRoles: string[];
  alternativeRoles: string[];
  location?: string;
  remoteOnly?: boolean;
  maximumResults?: number;
  strategyName?: string;
  requiredSkills?: string[];
}

export interface DiscoveredJob {
  sourceUrl: string;
  title: string;
  companyName: string;
  location?: string;
  remoteType?: 'REMOTE' | 'ONSITE' | 'HYBRID';
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  description?: string;
  rawContent?: string;
}

export interface DiscoveryResult {
  jobs: DiscoveredJob[];
  unstructuredText?: string; // Fallback if provider can only extract raw text (e.g. SearchEngine)
  metadata?: any;
  latencyMs: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  reachable: boolean;
  authenticationRequired: boolean;
  warnings?: string[];
  jobsFound?: number;
}

export interface DiscoveryProvider {
  readonly id: string;
  readonly name: string;
  readonly providerType: ProviderType;
  readonly version: string;
  readonly priority: number;

  capabilities(): ProviderCapabilities;
  
  discover(context: DiscoveryContext): Promise<DiscoveryResult>;
  healthCheck(sourceUrl: string): Promise<HealthCheckResult>;
  validate(sourceUrl: string): Promise<boolean>;
  normalize(job: DiscoveredJob): DiscoveredJob;
  supports(sourceUrl: string): boolean;
  
  emitTelemetry(event: string, payload: any): void;
}
