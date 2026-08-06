import { db } from '../client.js';
import * as schema from '../schema.js';
import { eq } from 'drizzle-orm';

// Providers
export async function getProvider(id: string) {
  return db.select().from(schema.providers).where(eq(schema.providers.id, id)).get();
}

export async function createProvider(provider: typeof schema.providers.$inferInsert) {
  return db.insert(schema.providers).values(provider).returning().get();
}

export async function updateProvider(id: string, provider: Partial<typeof schema.providers.$inferInsert>) {
  return db.update(schema.providers).set(provider).where(eq(schema.providers.id, id)).returning().get();
}

// Sources
export async function getSource(id: string) {
  return db.select().from(schema.sources).where(eq(schema.sources.id, id)).get();
}

export async function createSource(source: typeof schema.sources.$inferInsert) {
  return db.insert(schema.sources).values(source).returning().get();
}

export async function updateSource(id: string, source: Partial<typeof schema.sources.$inferInsert>) {
  return db.update(schema.sources).set(source).where(eq(schema.sources.id, id)).returning().get();
}

// Groups
export async function getGroup(id: string) {
  return db.select().from(schema.groups).where(eq(schema.groups.id, id)).get();
}

export async function createGroup(group: typeof schema.groups.$inferInsert) {
  return db.insert(schema.groups).values(group).returning().get();
}

export async function updateGroup(id: string, group: Partial<typeof schema.groups.$inferInsert>) {
  return db.update(schema.groups).set(group).where(eq(schema.groups.id, id)).returning().get();
}

// Group Members
export async function getGroupMembers(groupId: string) {
  return db.select().from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId)).all();
}

export async function addGroupMember(member: typeof schema.groupMembers.$inferInsert) {
  return db.insert(schema.groupMembers).values(member).returning().get();
}

export async function removeGroupMember(id: string) {
  return db.delete(schema.groupMembers).where(eq(schema.groupMembers.id, id)).returning().get();
}

// Watchlists
export async function getWatchlist(id: string) {
  return db.select().from(schema.watchlists).where(eq(schema.watchlists.id, id)).get();
}

export async function createWatchlist(watchlist: typeof schema.watchlists.$inferInsert) {
  return db.insert(schema.watchlists).values(watchlist).returning().get();
}

export async function updateWatchlist(id: string, watchlist: Partial<typeof schema.watchlists.$inferInsert>) {
  return db.update(schema.watchlists).set(watchlist).where(eq(schema.watchlists.id, id)).returning().get();
}

// Source Runs
export async function getSourceRun(id: string) {
  return db.select().from(schema.sourceRuns).where(eq(schema.sourceRuns.id, id)).get();
}

export async function createSourceRun(sourceRun: typeof schema.sourceRuns.$inferInsert) {
  return db.insert(schema.sourceRuns).values(sourceRun).returning().get();
}

export async function updateSourceRun(id: string, sourceRun: Partial<typeof schema.sourceRuns.$inferInsert>) {
  return db.update(schema.sourceRuns).set(sourceRun).where(eq(schema.sourceRuns.id, id)).returning().get();
}

// Provider Statistics
export async function getProviderStatistics(id: string) {
  return db.select().from(schema.providerStatistics).where(eq(schema.providerStatistics.id, id)).get();
}

export async function createProviderStatistics(stats: typeof schema.providerStatistics.$inferInsert) {
  return db.insert(schema.providerStatistics).values(stats).returning().get();
}

export async function updateProviderStatistics(id: string, stats: Partial<typeof schema.providerStatistics.$inferInsert>) {
  return db.update(schema.providerStatistics).set(stats).where(eq(schema.providerStatistics.id, id)).returning().get();
}
