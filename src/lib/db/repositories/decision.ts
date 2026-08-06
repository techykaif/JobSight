import { db } from '../client.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

// --- Decision Results ---

export async function getDecisionResult(id: string) {
  return db.select().from(schema.decisionResults).where(eq(schema.decisionResults.id, id)).get();
}

export async function getDecisionResultsByJobId(jobId: string) {
  return db.select().from(schema.decisionResults).where(eq(schema.decisionResults.jobId, jobId)).all();
}

export async function insertDecisionResult(data: typeof schema.decisionResults.$inferInsert) {
  return db.insert(schema.decisionResults).values(data).returning().get();
}

export async function updateDecisionResult(id: string, data: Partial<typeof schema.decisionResults.$inferInsert>) {
  return db.update(schema.decisionResults).set(data).where(eq(schema.decisionResults.id, id)).returning().get();
}

// --- Decision Queue ---

export async function getDecisionQueueItem(id: string) {
  return db.select().from(schema.decisionQueue).where(eq(schema.decisionQueue.id, id)).get();
}

export async function getDecisionQueueByJobId(jobId: string) {
  return db.select().from(schema.decisionQueue).where(eq(schema.decisionQueue.jobId, jobId)).all();
}

export async function insertDecisionQueueItem(data: typeof schema.decisionQueue.$inferInsert) {
  return db.insert(schema.decisionQueue).values(data).returning().get();
}

export async function updateDecisionQueueItem(id: string, data: Partial<typeof schema.decisionQueue.$inferInsert>) {
  return db.update(schema.decisionQueue).set(data).where(eq(schema.decisionQueue.id, id)).returning().get();
}

// --- Decision Actions ---

export async function getDecisionAction(id: string) {
  return db.select().from(schema.decisionActions).where(eq(schema.decisionActions.id, id)).get();
}

export async function getDecisionActionsByJobId(jobId: string) {
  return db.select().from(schema.decisionActions).where(eq(schema.decisionActions.jobId, jobId)).all();
}

export async function insertDecisionAction(data: typeof schema.decisionActions.$inferInsert) {
  return db.insert(schema.decisionActions).values(data).returning().get();
}

export async function updateDecisionAction(id: string, data: Partial<typeof schema.decisionActions.$inferInsert>) {
  return db.update(schema.decisionActions).set(data).where(eq(schema.decisionActions.id, id)).returning().get();
}

// --- Decision History ---

export async function getDecisionHistory(id: string) {
  return db.select().from(schema.decisionHistory).where(eq(schema.decisionHistory.id, id)).get();
}

export async function getDecisionHistoryByJobId(jobId: string) {
  return db.select().from(schema.decisionHistory).where(eq(schema.decisionHistory.jobId, jobId)).all();
}

export async function insertDecisionHistory(data: typeof schema.decisionHistory.$inferInsert) {
  return db.insert(schema.decisionHistory).values(data).returning().get();
}
