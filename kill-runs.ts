import { db } from './src/lib/db/client.js';
import * as schema from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function cancelActiveRuns() {
  const active = await db.select().from(schema.runs).where(eq(schema.runs.status, 'RUNNING'));
  for (const r of active) {
    console.log(`Cancelling run ${r.id}...`);
    await db.update(schema.runs).set({ status: 'CANCELLED' }).where(eq(schema.runs.id, r.id));
  }
  const created = await db.select().from(schema.runs).where(eq(schema.runs.status, 'CREATED'));
  for (const r of created) {
    console.log(`Cancelling run ${r.id}...`);
    await db.update(schema.runs).set({ status: 'CANCELLED' }).where(eq(schema.runs.id, r.id));
  }
  console.log(`Cancelled ${active.length} RUNNING runs and ${created.length} CREATED runs.`);
}
cancelActiveRuns().catch(console.error).then(() => process.exit(0));
