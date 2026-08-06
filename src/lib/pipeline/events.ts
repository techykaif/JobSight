import { db } from '../db/client';
import * as schema from '../db/schema';
import crypto from 'crypto';

export type EventType = 
  | 'RUN_STARTED'
  | 'PREFLIGHT_STARTED'
  | 'PREFLIGHT_COMPLETED'
  | 'PREFLIGHT_FAILED'
  | 'DISCOVERY_STARTED'
  | 'DISCOVERY_BATCH_STARTED'
  | 'DISCOVERY_BATCH_COMPLETED'
  | 'JOB_DISCOVERED'
  | 'JOB_DUPLICATE'
  | 'JOB_INGESTED'
  | 'JOB_REJECTED'
  | 'QUALIFICATION_STARTED'
  | 'QUALIFICATION_COMPLETED'
  | 'COMPANY_RESEARCH_STARTED'
  | 'COMPANY_RESEARCH_COMPLETED'
  | 'COMPANY_RESEARCH_FAILED'
  | 'SCORE_UPDATED'
  | 'RUN_PAUSED'
  | 'RUN_RESUMED'
  | 'RUN_CANCELLING'
  | 'RUN_CANCELLED'
  | 'RUN_COMPLETED'
  | 'RUN_FAILED'
  | 'JOB_REAPPEARED'
  | 'POSSIBLE_REPOST_DETECTED'
  | 'RUN_RESUMED_FROM_CHECKPOINT'
  | 'QUALIFICATION_FAILED'
  | 'COMPANY_RESEARCH_SKIPPED'
  | 'MAX_USABLE_RESULTS_REACHED'
  | 'RETRY_EXHAUSTED';

export interface EmitEventArgs {
  runId: string;
  type: EventType;
  stage: string;
  entityType?: 'JOB' | 'COMPANY' | 'RUN';
  entityId?: string;
  payload?: any;
  message?: string;
}

export async function emitEvent(args: EmitEventArgs) {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // 1. Write to terminal logs
  const entityPart = args.entityId ? `[${args.entityType || 'ENTITY'}:${args.entityId.slice(0, 8)}]` : '';
  const msgPart = args.message ? ` - ${args.message}` : '';
  console.log(`[${timestamp}] ${args.stage.padEnd(10)} ${args.type.padEnd(25)} ${entityPart}${msgPart}`);

  // 2. Persist to DB
  try {
    const dbRow: any = {
      id: eventId,
      runId: args.runId,
      eventType: args.type,
      timestamp
    };
    if (args.stage !== undefined) dbRow.stage = args.stage;
    if (args.entityType !== undefined) dbRow.entityType = args.entityType;
    if (args.entityId !== undefined) dbRow.entityId = args.entityId;
    
    const payloadObj = args.payload ? { ...args.payload } : {};
    if (args.message) payloadObj.message = args.message;
    if (Object.keys(payloadObj).length > 0) dbRow.payload = payloadObj;

    await db.insert(schema.pipelineEvents).values(dbRow);
  } catch (e) {
    console.error(`[EVENTS] Failed to persist event ${args.type} for run ${args.runId}`, e);
  }
}
