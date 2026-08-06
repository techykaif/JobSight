import { db } from '../client.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

export async function saveHuntConfig(config: typeof schema.huntConfigs.$inferInsert) {
  return db.insert(schema.huntConfigs).values(config).returning().get();
}

export async function createRun(run: typeof schema.runs.$inferInsert) {
  return db.insert(schema.runs).values(run).returning().get();
}

export async function upsertCompany(company: typeof schema.companies.$inferInsert) {
  return db.insert(schema.companies).values(company)
    .onConflictDoUpdate({
      target: schema.companies.normalizedName,
      set: {
        displayName: company.displayName,
        website: company.website,
        careersUrl: company.careersUrl,
        updatedAt: company.updatedAt
      }
    }).returning().get();
}

export async function upsertJob(job: typeof schema.jobs.$inferInsert) {
  return db.insert(schema.jobs).values(job)
    .onConflictDoUpdate({
      target: schema.jobs.canonicalUrl,
      set: {
        companyId: job.companyId,
        canonicalTitle: job.canonicalTitle,
        normalizedTitle: job.normalizedTitle,
        location: job.location,
        remoteType: job.remoteType,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        salaryPeriod: job.salaryPeriod,
        experienceMin: job.experienceMin,
        experienceMax: job.experienceMax,
        description: job.description,
        lastSeenAt: job.lastSeenAt,
        status: job.status,
        updatedAt: job.updatedAt
      }
    }).returning().get();
}

export async function createJobObservation(observation: typeof schema.jobObservations.$inferInsert) {
  return db.insert(schema.jobObservations).values(observation).returning().get();
}

export async function saveSource(source: typeof schema.jobSources.$inferInsert) {
  return db.insert(schema.jobSources).values(source).returning().get();
}

export async function saveResearchArtifact(artifact: typeof schema.researchArtifacts.$inferInsert) {
  return db.insert(schema.researchArtifacts).values(artifact).returning().get();
}

export async function saveEvidence(evidenceData: typeof schema.evidence.$inferInsert) {
  return db.insert(schema.evidence).values(evidenceData).returning().get();
}

export async function saveAnalysis(analysisData: typeof schema.jobAnalysis.$inferInsert) {
  return db.insert(schema.jobAnalysis).values(analysisData).returning().get();
}

export async function saveScore(scoreData: typeof schema.scores.$inferInsert) {
  return db.insert(schema.scores).values(scoreData).returning().get();
}

export async function saveEvent(event: typeof schema.pipelineEvents.$inferInsert) {
  return db.insert(schema.pipelineEvents).values(event).returning().get();
}

export async function saveFailure(failure: typeof schema.failures.$inferInsert) {
  return db.insert(schema.failures).values(failure).returning().get();
}

export async function queryJobWithRelatedCompany(jobId: string) {
  const result = await db.select({
    job: schema.jobs,
    company: schema.companies
  })
  .from(schema.jobs)
  .leftJoin(schema.companies, eq(schema.jobs.companyId, schema.companies.id))
  .where(eq(schema.jobs.id, jobId))
  .get();
  
  return result;
}

export * from './discovery.js';
export * from './intelligence.js';
export * from './decision.js';
export * from './strategy.js';
