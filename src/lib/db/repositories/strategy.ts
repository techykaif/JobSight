import { db } from '../client.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

export async function createDiscoveryStrategy(strategy: typeof schema.discoveryStrategies.$inferInsert) {
  return db.insert(schema.discoveryStrategies).values(strategy).returning().get();
}

export async function getDiscoveryStrategy(id: string) {
  return db.select().from(schema.discoveryStrategies).where(eq(schema.discoveryStrategies.id, id)).get();
}

export async function createStrategyRun(run: typeof schema.strategyRuns.$inferInsert) {
  return db.insert(schema.strategyRuns).values(run).returning().get();
}

export async function getStrategyRun(id: string) {
  return db.select().from(schema.strategyRuns).where(eq(schema.strategyRuns.id, id)).get();
}

export async function createStrategyStatistics(stats: typeof schema.strategyStatistics.$inferInsert) {
  return db.insert(schema.strategyStatistics).values(stats).returning().get();
}

export async function getStrategyStatistics(id: string) {
  return db.select().from(schema.strategyStatistics).where(eq(schema.strategyStatistics.id, id)).get();
}
