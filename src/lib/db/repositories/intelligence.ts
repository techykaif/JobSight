import { db } from '../client.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

export async function saveDiscoveryIntelligence(data: typeof schema.discoveryIntelligence.$inferInsert) {
  return db.insert(schema.discoveryIntelligence).values(data).returning().get();
}

export async function getDiscoveryIntelligenceByJobId(jobId: string) {
  return db.select().from(schema.discoveryIntelligence).where(eq(schema.discoveryIntelligence.jobId, jobId)).get();
}

export async function updateDiscoveryIntelligence(id: string, data: Partial<typeof schema.discoveryIntelligence.$inferInsert>) {
  return db.update(schema.discoveryIntelligence).set(data).where(eq(schema.discoveryIntelligence.id, id)).returning().get();
}

export async function saveAnalyzerResult(data: typeof schema.analyzerResults.$inferInsert) {
  return db.insert(schema.analyzerResults).values(data).returning().get();
}

export async function getAnalyzerResultsByJobId(jobId: string) {
  return db.select().from(schema.analyzerResults).where(eq(schema.analyzerResults.jobId, jobId)).all();
}

export async function updateAnalyzerResult(id: string, data: Partial<typeof schema.analyzerResults.$inferInsert>) {
  return db.update(schema.analyzerResults).set(data).where(eq(schema.analyzerResults.id, id)).returning().get();
}

export async function saveOpportunityIntelligence(data: typeof schema.opportunityIntelligence.$inferInsert) {
  return db.insert(schema.opportunityIntelligence).values(data).returning().get();
}

export async function getOpportunityIntelligenceByJobId(jobId: string) {
  return db.select().from(schema.opportunityIntelligence).where(eq(schema.opportunityIntelligence.jobId, jobId)).get();
}

export async function updateOpportunityIntelligence(id: string, data: Partial<typeof schema.opportunityIntelligence.$inferInsert>) {
  return db.update(schema.opportunityIntelligence).set(data).where(eq(schema.opportunityIntelligence.id, id)).returning().get();
}
