import crypto from 'crypto';
import { runAgyTask, runAgyUnstructured } from '../agy/runner.js';
import * as repos from '../db/repositories/index.js';
import { StructuringOutputSchema, EXTERNAL_AGY_STRUCTURING_CONTRACT } from '../jobs/extractionSchema.js';
import { normalizeJobExtraction, ValidationError } from '../jobs/normalize.js';
import { persistCandidateJob } from '../jobs/persist.js';
import { runDiscovery } from '../discovery/orchestrator.js';
export async function runIngestionPipeline(runId: string, config: any, abortSignal?: AbortSignal) {
  console.log(`[RUN] Started ingestion run: ${runId}`);
  
  // 1. Stage A: RETRIEVAL
  console.log(`[RETRIEVAL] Starting AGY Stage A (Unstructured)`);
  const candidateCountry = config.candidateCountry || 'India';
  const scope = config.searchScope || 'LOCAL_AND_GLOBAL';
  const maxUsable = config.maximumUsableResults || 3;
  const inspectionLimit = maxUsable * 3; // Bounded over-discovery cap

  let rawResearch = '';
  let discoveredJobs = [];
  try {
    const discoveryResult = await runDiscovery(runId, config, abortSignal);
    rawResearch = discoveryResult.unstructuredText;
    discoveredJobs = discoveryResult.jobs;
    console.log(`[RETRIEVAL] Complete. Discovered ${discoveredJobs.length} structured jobs and unstructured text.`);
  } catch (error: any) {
    console.error(`[RETRIEVAL] Failed: ${error.message}`);
    await repos.saveFailure({
      id: crypto.randomUUID(),
      runId,
      stage: 'RETRIEVAL',
      failureCode: 'RETRIEVAL_FAILED',
      message: error.message,
      attempt: 1,
      retryable: false,
      createdAt: new Date().toISOString()
    });
    return { discovered: 0, structured: 0, valid: 0, persisted: 0, failed: 1 };
  }

  // 2. Preserve Raw Research Artifact
  await repos.saveResearchArtifact({
    id: crypto.randomUUID(),
    runId,
    entityType: 'JOB_DISCOVERY',
    workerType: 'AGY_UNSTRUCTURED_FETCH',
    rawContent: rawResearch,
    createdAt: new Date().toISOString()
  });
  console.log(`[RETRIEVAL] Raw artifact saved.`);

  // 3. Stage B: STRUCTURING
  console.log(`[STRUCTURE] Starting AGY Stage B (Structured)`);
  const chunkMarkdown = (text: string, maxLen: number) => {
    const lines = text.split('\n');
    const chunks = [];
    let cur = '';
    for (const line of lines) {
      if (cur.length + line.length > maxLen && cur.length > 0) {
        chunks.push(cur);
        cur = '';
      }
      cur += line + '\n';
    }
    if (cur.trim()) chunks.push(cur);
    return chunks;
  };

  let structuredData = { candidates: [] as any[] };
  const stageBStartTime = Date.now();
  
  try {
    const chunks = chunkMarkdown(rawResearch, 6000);
    console.log(`[STRUCTURE] Split raw research into ${chunks.length} chunks`);
    
    const MAX_STAGE_B_CONCURRENCY = 2;
    let activeAgyProcesses = 0;
    let peakAgyProcesses = 0;
    let chunksCompleted = 0;
    const chunkLatencies: number[] = [];
    let totalQueueWaitTime = 0;

    const queue = chunks.map(chunk => ({ chunk, queuedAt: Date.now() }));
    const results: any[] = [];

    const processChunk = async (chunk: string) => {
      if (abortSignal?.aborted) return { candidates: [] };
      activeAgyProcesses++;
      if (activeAgyProcesses > peakAgyProcesses) peakAgyProcesses = activeAgyProcesses;
      const start = Date.now();
      
      const structurePrompt = `
YOU ARE NOT RESEARCHING.
Use ONLY the supplied research material below.
Do not add outside knowledge.
Do not guess missing fields. Do not infer salary, remote status, or experience unless explicitly stated in the text.
If unsupported: return null.

CRITICAL REQUIREMENT:
You must extract the job opportunities from the Research Material and populate the "candidates" array in the JSON schema. Ensure you return a valid object containing the "candidates" array. If no jobs are found, return {"candidates": []}.

Research Material:
"""
${chunk}
"""
      `;
      
      try {
        const res = await runAgyTask({
          prompt: structurePrompt,
          schema: StructuringOutputSchema,
          jsonSchemaDef: EXTERNAL_AGY_STRUCTURING_CONTRACT,
          timeoutMs: 60000,
          maxAttempts: 2,
          ...(abortSignal ? { abortSignal } : {})
        });
        chunkLatencies.push(Date.now() - start);
        return res;
      } finally {
        activeAgyProcesses--;
        chunksCompleted++;
      }
    };

    const worker = async () => {
      while (queue.length > 0) {
        if (abortSignal?.aborted) break;
        const item = queue.shift()!;
        totalQueueWaitTime += Date.now() - item.queuedAt;
        const res = await processChunk(item.chunk);
        results.push(res);
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(MAX_STAGE_B_CONCURRENCY, chunks.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    structuredData.candidates = results.flatMap(r => r.candidates);

    // Merge directly discovered structured jobs (e.g., from ATS Providers API)
    const mappedDiscovered = discoveredJobs.map(dj => ({
      job: {
        title: dj.title,
        url: dj.sourceUrl,
        location: dj.location,
        remoteType: dj.remoteType,
        salaryMin: dj.salaryMin,
        salaryMax: dj.salaryMax,
        salaryCurrency: dj.salaryCurrency,
        salaryPeriod: dj.salaryPeriod
      },
      company: {
        name: dj.companyName
      },
      sources: [{ url: dj.sourceUrl }]
    }));
    
    structuredData.candidates.push(...mappedDiscovered);

    const stageBDuration = Date.now() - stageBStartTime;
    console.log(`[STRUCTURE] Completed structuring ${structuredData.candidates.length} candidates in ${stageBDuration}ms.`);
    
    const averageChunkLatency = chunkLatencies.length > 0 ? chunkLatencies.reduce((a,b)=>a+b,0) / chunkLatencies.length : 0;

    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      eventType: 'STAGE_B_TELEMETRY',
      stage: 'STRUCTURING',
      payload: {
        latencyMs: stageBDuration,
        chunksCreated: chunks.length,
        chunksCompleted,
        activeChunkWorkers: workers.length,
        peakChunkWorkers: workers.length,
        activeAgyProcesses: 0,
        peakAgyProcesses,
        queueWaitTime: totalQueueWaitTime,
        averageChunkLatency,
        markdownSizeChars: rawResearch.length,
        schemaSizeChars: JSON.stringify(EXTERNAL_AGY_STRUCTURING_CONTRACT).length,
        candidatesOutput: structuredData.candidates.length,
        success: true
      }
    });
  } catch (error: any) {
    const stageBDuration = Date.now() - stageBStartTime;
    console.error(`[STRUCTURE] Failed: ${error.message} (after ${stageBDuration}ms)`);
    
    await repos.saveEvent({
      id: crypto.randomUUID(),
      runId,
      timestamp: new Date().toISOString(),
      eventType: 'STAGE_B_TELEMETRY',
      stage: 'STRUCTURING',
      payload: {
        latencyMs: stageBDuration,
        markdownSizeChars: rawResearch.length,
        schemaSizeChars: JSON.stringify(EXTERNAL_AGY_STRUCTURING_CONTRACT).length,
        success: false,
        error: error.message
      }
    });
    await repos.saveFailure({
      id: crypto.randomUUID(),
      runId,
      stage: 'STRUCTURING',
      failureCode: 'STRUCTURING_FAILED',
      message: error.message,
      attempt: 1,
      retryable: false,
      createdAt: new Date().toISOString()
    });
    return { discovered: 1, structured: 0, valid: 0, persisted: 0, failed: 1 };
  }

  // 4. Normalization & Persistence Loop
  let validCount = 0;
  let persistedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < structuredData.candidates.length; i++) {
    const candidate = structuredData.candidates[i];
    if (!candidate) continue;
    console.log(`\n[VALIDATE] Candidate ${i + 1}/${structuredData.candidates.length}`);
    try {
      const normalized = normalizeJobExtraction(candidate);
      console.log(`[VALIDATE] PASS: ${normalized.company.name} - ${normalized.job.title}`);
      validCount++;

      console.log(`[PERSIST] Saving...`);
      await persistCandidateJob(runId, normalized);
      console.log(`[PERSIST] Success.`);
      persistedCount++;
    } catch (error: any) {
      console.error(`[VALIDATE/PERSIST] Failed: ${error.message}`);
      failedCount++;
      await repos.saveFailure({
        id: crypto.randomUUID(),
        runId,
        stage: error instanceof ValidationError ? 'VALIDATION' : 'PERSISTENCE',
        failureCode: error instanceof ValidationError ? 'VALIDATION_FAILED' : 'PERSISTENCE_FAILED',
        message: error.message,
        attempt: 1,
        retryable: false,
        createdAt: new Date().toISOString()
      });
    }
  }

  return {
    discovered: structuredData.candidates.length,
    structured: structuredData.candidates.length,
    valid: validCount,
    persisted: persistedCount,
    failed: failedCount
  };
}
