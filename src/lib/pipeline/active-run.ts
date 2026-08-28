import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { desc, inArray } from 'drizzle-orm';

/**
 * Returns the most recent run that has advanced past initialization stages.
 * We consider RUNNING, PAUSED, and COMPLETED as valid UI states.
 * This prevents FAILED, ABORTED, CREATED, or PREFLIGHT runs from shadowing
 * completed historical runs on the UI.
 */
export async function getActiveRun() {
  const activeRunRes = await db.select()
    .from(schema.runs)
    .where(inArray(schema.runs.status, ['RUNNING', 'PAUSED', 'COMPLETED', 'COMPLETED_WITH_FAILURES']))
    .orderBy(desc(schema.runs.createdAt))
    .limit(1);
  return activeRunRes[0] || null;
}
