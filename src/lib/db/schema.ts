import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Reusable column configurations
const timestampFields = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

export const huntConfigs = sqliteTable('hunt_configs', {
  id: text('id').primaryKey(), // UUID
  targetRoles: text('target_roles', { mode: 'json' }).notNull(), // string[]
  alternativeRoles: text('alternative_roles', { mode: 'json' }).notNull(), // string[]
  candidateCountry: text('candidate_country'), // e.g., 'India'
  allowedRegions: text('allowed_regions', { mode: 'json' }), // string[]
  searchScope: text('search_scope'), // LOCAL, GLOBAL_REMOTE, LOCAL_AND_GLOBAL
  remoteRequirement: text('remote_requirement'), // REMOTE_ONLY, HYBRID, etc.
  requireSalaryDisclosure: integer('require_salary_disclosure', { mode: 'boolean' }).default(true),
  minimumDesiredSalary: integer('minimum_desired_salary'),
  desiredSalaryCurrency: text('desired_salary_currency').default('INR'),
  desiredSalaryPeriod: text('desired_salary_period').default('MONTH'),
  maximumUsableResults: integer('maximum_usable_results').default(3),
  // Legacy fields
  salaryMinimum: integer('salary_minimum'),
  salaryPreferred: integer('salary_preferred'),
  currency: text('currency').default('USD'),
  experiencePreferences: text('experience_preferences', { mode: 'json' }), // object
  requiredSkills: text('required_skills', { mode: 'json' }), // string[]
  excludedCompanies: text('excluded_companies', { mode: 'json' }), // string[]
  
  // V1.0.1-A5.1 Discovery config
  discoveryStrategy: text('discovery_strategy'),
  discoveryGroups: text('discovery_groups', { mode: 'json' }), // string[]
  userUrls: text('user_urls', { mode: 'json' }), // string[]
  maximumProviders: integer('maximum_providers'),
  maximumRuntime: integer('maximum_runtime'),
  ...timestampFields
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  configId: text('config_id').notNull().references(() => huntConfigs.id),
  status: text('status').notNull(), // CREATED, PREFLIGHT, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED
  currentStage: text('current_stage'),
  errorSummary: text('error_summary'),
  profileSnapshot: text('profile_snapshot', { mode: 'json' }),
  lastCheckpoint: text('last_checkpoint'),
  executorId: text('executor_id'),
  heartbeatAt: text('heartbeat_at'),
  leaseExpiresAt: text('lease_expires_at'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  pausedAt: text('paused_at'),
  ...timestampFields
});

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  normalizedName: text('normalized_name').notNull().unique(),
  displayName: text('display_name').notNull(),
  website: text('website'),
  careersUrl: text('careers_url'),
  ...timestampFields
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id), // Nullable if company unknown
  canonicalTitle: text('canonical_title'),
  normalizedTitle: text('normalized_title'),
  canonicalUrl: text('canonical_url').unique(),
  location: text('location'),
  remoteType: text('remote_type'), // e.g., 'REMOTE', 'ONSITE', 'HYBRID'
  candidateRemoteEligibility: text('candidate_remote_eligibility'), // ELIGIBLE, NOT_ELIGIBLE, UNKNOWN
  employmentType: text('employment_type'),
  
  // Normalized for ranking/display
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  salaryCurrency: text('salary_currency'),
  salaryPeriod: text('salary_period'),
  
  // Original extracted
  salaryMinOriginal: integer('salary_min_original'),
  salaryMaxOriginal: integer('salary_max_original'),
  salaryCurrencyOriginal: text('salary_currency_original'),
  salaryPeriodOriginal: text('salary_period_original'),
  salaryTextOriginal: text('salary_text_original'),

  experienceMin: integer('experience_min'),
  experienceMax: integer('experience_max'),
  description: text('description'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  status: text('status').notNull(), // ACTIVE, INACTIVE, UNKNOWN
  ...timestampFields
});

export const jobObservations = sqliteTable('job_observations', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  observedAt: text('observed_at').notNull(),
  status: text('status'), // Active, Closed, etc. at time of observation
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  location: text('location'),
  remoteType: text('remote_type'),
  rawMetadata: text('raw_metadata', { mode: 'json' }) // Any extra observed fields at this time
});

export const jobSources = sqliteTable('job_sources', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  sourceUrl: text('source_url').notNull(),
  sourceType: text('source_type').notNull(), // OFFICIAL_JOB_PAGE, ATS, SEARCH_RESULT, etc.
  retrievedAt: text('retrieved_at').notNull(),
  httpStatus: integer('http_status'),
  finalUrl: text('final_url'),
  sourceTitle: text('source_title'),
  externalJobId: text('external_job_id')
});

export const researchArtifacts = sqliteTable('research_artifacts', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  entityType: text('entity_type').notNull(), // JOB, COMPANY, MARKET
  entityId: text('entity_id'), // jobId or companyId
  workerType: text('worker_type').notNull(), // AGY_UNSTRUCTURED_FETCH, BROWSER, etc.
  rawContent: text('raw_content').notNull(), // The raw text/markdown retrieved
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull()
});

export const evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  sourceId: text('source_id').references(() => jobSources.id),
  entityType: text('entity_type').notNull(), // JOB, COMPANY
  entityId: text('entity_id').notNull(),
  field: text('field').notNull(), // e.g., 'remoteType', 'salary'
  valueRepresentation: text('value_representation'), // The extracted value
  evidenceExcerpt: text('evidence_excerpt'), // Snippet from source proving it
  evidenceType: text('evidence_type').notNull(), // FACT, INFERENCE
  confidence: integer('confidence'), // 0-100
  createdAt: text('created_at').notNull()
});

export const jobAnalysis = sqliteTable('job_analysis', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  experienceFlexibility: text('experience_flexibility'),
  seniorityAssessment: text('seniority_assessment'),
  requirementDifficulty: text('requirement_difficulty'),
  competitionEstimate: text('competition_estimate'),
  analysisReasoning: text('analysis_reasoning'),
  analysisTimestamp: text('analysis_timestamp').notNull(),
  workerMetadata: text('worker_metadata', { mode: 'json' })
});

export const companyAnalysis = sqliteTable('company_analysis', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id),
  runId: text('run_id').references(() => runs.id),
  remoteFriendliness: text('remote_friendliness'),
  hiringMomentum: text('hiring_momentum'),
  growthSignal: text('growth_signal'),
  layoffSignal: text('layoff_signal'),
  engineeringHiringActivity: text('engineering_hiring_activity'),
  researchTimestamp: text('research_timestamp').notNull()
});

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  scoreType: text('score_type').notNull(), // RESUME_MATCH, OPPORTUNITY, etc.
  scoreValue: integer('score_value').notNull(),
  scoringVersion: text('scoring_version').notNull(),
  createdAt: text('created_at').notNull()
});

export const pipelineEvents = sqliteTable('pipeline_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  timestamp: text('timestamp').notNull(),
  eventType: text('event_type').notNull(),
  stage: text('stage'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  payload: text('payload', { mode: 'json' })
});

export const failures = sqliteTable('failures', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  stage: text('stage'),
  worker: text('worker'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  failureCode: text('failure_code').notNull(),
  message: text('message').notNull(),
  attempt: integer('attempt').notNull(),
  retryable: integer('retryable', { mode: 'boolean' }).notNull(),
  resolved: integer('resolved', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at')
});


export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  decision: text('decision').notNull(), // APPLY, CONSIDER, SKIP, RESEARCH_REQUIRED
  reasons: text('reasons', { mode: 'json' }), // string[]
  unknowns: text('unknowns', { mode: 'json' }), // string[]
  createdAt: text('created_at').notNull()
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  yearsOfProfessionalExperience: integer('years_of_professional_experience').notNull(),
  education: text('education'),
  targetRoles: text('target_roles', { mode: 'json' }).notNull(), // string[]
  skills: text('skills', { mode: 'json' }).notNull(), // string[]
  projectExperience: text('project_experience', { mode: 'json' }), // string[]
  preferredRoles: text('preferred_roles', { mode: 'json' }), // string[]
  salaryExpectations: text('salary_expectations', { mode: 'json' }), // object { minimum, preferred, currency }
  remotePreference: text('remote_preference', { mode: 'json' }), // string[]
  allowedRegions: text('allowed_regions', { mode: 'json' }), // string[]
  employmentPreferences: text('employment_preferences', { mode: 'json' }), // string[]
  ...timestampFields
});

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  version: text('version'),
  registeredAt: text('registered_at').notNull()
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ...timestampFields
});

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  provider: text('provider').notNull(),
  url: text('url'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  priority: integer('priority'),
  groupId: text('group_id').references(() => groups.id),
  country: text('country'),
  allowedRegions: text('allowed_regions', { mode: 'json' }),
  remotePreference: text('remote_preference'),
  crawlDepth: integer('crawl_depth'),
  crawlFrequency: integer('crawl_frequency'),
  lastRun: text('last_run'),
  lastSuccess: text('last_success'),
  lastFailure: text('last_failure'),
  failureCount: integer('failure_count').default(0),
  jobsDiscovered: integer('jobs_discovered').default(0),
  averageLatency: integer('average_latency'),
  successRate: integer('success_rate'),
  notes: text('notes'),
  ...timestampFields
});

export const groupMembers = sqliteTable('group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id),
  sourceId: text('source_id').notNull().references(() => sources.id)
});

export const watchlists = sqliteTable('watchlists', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id),
  priority: integer('priority'),
  ...timestampFields
});

export const sourceRuns = sqliteTable('source_runs', {
  id: text('id').primaryKey(),
  sourceId: text('source_id').notNull().references(() => sources.id),
  runId: text('run_id').notNull().references(() => runs.id),
  status: text('status').notNull(),
  jobsFound: integer('jobs_found'),
  latency: integer('latency'),
  ...timestampFields
});

export const providerStatistics = sqliteTable('provider_statistics', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => providers.id),
  totalRuns: integer('total_runs').default(0),
  totalJobs: integer('total_jobs').default(0),
  successRate: integer('success_rate'),
  ...timestampFields
});

export const discoveryIntelligence = sqliteTable('discovery_intelligence', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  hiddenGem: integer('hidden_gem', { mode: 'boolean' }),
  visibility: text('visibility'),
  authenticity: text('authenticity'),
  competition: text('competition'),
  freshness: text('freshness'),
  sourceTrust: text('source_trust'),
  confidence: integer('confidence'),
  signals: text('signals', { mode: 'json' }),
  unknowns: text('unknowns', { mode: 'json' }),
  ...timestampFields
});

export const analyzerResults = sqliteTable('analyzer_results', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  analyzerId: text('analyzer_id').notNull(),
  output: text('output', { mode: 'json' }),
  confidence: integer('confidence'),
  signals: text('signals', { mode: 'json' }),
  unknowns: text('unknowns', { mode: 'json' }),
  ...timestampFields
});

export const opportunityIntelligence = sqliteTable('opportunity_intelligence', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  opportunityScore: integer('opportunity_score'),
  priority: text('priority'),
  recommendedAction: text('recommended_action'),
  ...timestampFields
});

export const decisionResults = sqliteTable('decision_results', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  decision: text('decision').notNull(),
  priority: text('priority'),
  confidence: integer('confidence'),
  reasons: text('reasons', { mode: 'json' }),
  unknowns: text('unknowns', { mode: 'json' }),
  requiredActions: text('required_actions', { mode: 'json' }),
  roiLevel: text('roi_level'),
  urgencyLevel: text('urgency_level'),
  ...timestampFields
});

export const decisionQueue = sqliteTable('decision_queue', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  queueRank: integer('queue_rank'),
  decision: text('decision'),
  recommendedAction: text('recommended_action'),
  ...timestampFields
});

export const decisionActions = sqliteTable('decision_actions', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  runId: text('run_id').references(() => runs.id),
  actionType: text('action_type').notNull(),
  description: text('description'),
  status: text('status'),
  ...timestampFields
});

export const decisionHistory = sqliteTable('decision_history', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id),
  previousDecision: text('previous_decision'),
  newDecision: text('new_decision'),
  reasonForChange: text('reason_for_change'),
  ...timestampFields
});

export const discoveryStrategies = sqliteTable('discovery_strategies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  ...timestampFields
});

export const strategyRuns = sqliteTable('strategy_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  strategyId: text('strategy_id').notNull().references(() => discoveryStrategies.id),
  totalBudgetMs: integer('total_budget_ms'),
  usedBudgetMs: integer('used_budget_ms'),
  terminatedEarly: integer('terminated_early', { mode: 'boolean' }),
  jobsDiscovered: integer('jobs_discovered'),
  jobsAccepted: integer('jobs_accepted'),
  jobsRejected: integer('jobs_rejected'),
  avgAuthenticity: integer('avg_authenticity'),
  avgVisibility: integer('avg_visibility'),
  ...timestampFields
});

export const strategyStatistics = sqliteTable('strategy_statistics', {
  id: text('id').primaryKey(),
  strategyId: text('strategy_id').notNull().references(() => discoveryStrategies.id),
  totalRuns: integer('total_runs'),
  avgJobsDiscovered: integer('avg_jobs_discovered'),
  avgBudgetUsed: integer('avg_budget_used'),
  ...timestampFields
});

export const observableSignals = sqliteTable('observable_signals', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  signalType: text('signal_type').notNull(),
  observedValue: text('observed_value'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull()
});

export const opportunityEvidence = sqliteTable('opportunity_evidence', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  category: text('category').notNull(), // e.g. SALARY, REMOTE, COMPANY
  confidence: integer('confidence'),
  createdAt: text('created_at').notNull()
});

export const evidenceItems = sqliteTable('evidence_items', {
  id: text('id').primaryKey(),
  opportunityEvidenceId: text('opportunity_evidence_id').notNull().references(() => opportunityEvidence.id),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  observedValue: text('observed_value'),
  normalizedValue: text('normalized_value'),
  weight: integer('weight'),
  confidence: integer('confidence'),
  source: text('source'),
  timestamp: text('timestamp').notNull(),
  metadata: text('metadata', { mode: 'json' })
});

export const confidenceResults = sqliteTable('confidence_results', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  confidenceScore: integer('confidence_score').notNull(),
  factors: text('factors', { mode: 'json' }), // which fields were missing/unknown etc
  createdAt: text('created_at').notNull()
});

export const evidenceSummary = sqliteTable('evidence_summary', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  opportunityScore: integer('opportunity_score'),
  confidence: integer('confidence'),
  evidenceChecklist: text('evidence_checklist', { mode: 'json' }), // string[]
  createdAt: text('created_at').notNull()
});

export const competitionResults = sqliteTable('competition_results', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  score: integer('score').notNull(), // 0-100
  level: text('level').notNull(), // Very Low, Low, Medium, High, Very High
  confidence: integer('confidence').notNull(),
  createdAt: text('created_at').notNull()
});

export const competitionSignals = sqliteTable('competition_signals', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  signalType: text('signal_type').notNull(),
  value: text('value'),
  weight: integer('weight').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull()
});

export const competitionSummary = sqliteTable('competition_summary', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  reasons: text('reasons', { mode: 'json' }), // string[] of '✓ Official Careers Page' etc.
  createdAt: text('created_at').notNull()
});

export const companyOpportunity = sqliteTable('company_opportunity', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  companyId: text('company_id').notNull().references(() => companies.id),
  score: integer('score').notNull(), // 0-100
  level: text('level').notNull(), // Excellent, Strong, Good, Average, Weak
  confidence: integer('confidence').notNull(),
  createdAt: text('created_at').notNull()
});

export const companySignals = sqliteTable('company_signals', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  companyId: text('company_id').notNull().references(() => companies.id),
  signalType: text('signal_type').notNull(),
  value: text('value'),
  weight: integer('weight').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull()
});

export const companySummary = sqliteTable('company_summary', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  companyId: text('company_id').notNull().references(() => companies.id),
  outlook: text('outlook').notNull(), // Excellent, Strong, etc.
  hiringTrend: text('hiring_trend').notNull(), // Growing, Stable, Slowing, Unknown
  remoteHiring: text('remote_hiring').notNull(),
  engineeringHiring: text('engineering_hiring').notNull(),
  competition: text('competition').notNull(),
  authenticity: text('authenticity').notNull(),
  evidenceCount: integer('evidence_count').notNull(),
  confidence: integer('confidence').notNull(),
  createdAt: text('created_at').notNull()
});

export const companyOutlook = sqliteTable('company_outlook', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  companyId: text('company_id').notNull().references(() => companies.id),
  trend: text('trend').notNull(), // Growing, Stable, Slowing, Unknown
  stability: text('stability').notNull(), // High, Medium, Low
  momentum: integer('momentum').notNull(), // 0-100
  createdAt: text('created_at').notNull()
});

export const oppDiscoveryResults = sqliteTable('opp_discovery_results', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  score: integer('score').notNull(), // 0-100
  level: text('level').notNull(), // Exceptional, Excellent, Strong, Standard, Weak
  confidence: integer('confidence').notNull(),
  createdAt: text('created_at').notNull()
});

export const oppDiscoverySignals = sqliteTable('opp_discovery_signals', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  signalType: text('signal_type').notNull(),
  value: text('value'),
  weight: integer('weight').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull()
});

export const oppDiscoverySummary = sqliteTable('opp_discovery_summary', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id),
  jobId: text('job_id').notNull().references(() => jobs.id),
  quality: text('quality').notNull(),
  source: text('source').notNull(),
  visibility: text('visibility').notNull(),
  uniqueness: text('uniqueness').notNull(),
  competition: text('competition').notNull(),
  authenticity: text('authenticity').notNull(),
  evidenceCount: integer('evidence_count').notNull(),
  confidence: integer('confidence').notNull(),
  createdAt: text('created_at').notNull()
});
