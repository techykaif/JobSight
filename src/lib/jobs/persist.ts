import crypto from 'crypto';
import type { CandidateJob } from './extractionSchema.js';
import * as repos from '../db/repositories/index.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { emitEvent } from '../pipeline/events.js';

export function normalizeUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('utm_term');
    url.searchParams.delete('utm_content');
    url.hash = ''; // Remove fragment
    let host = url.host.toLowerCase();
    if (host.startsWith('www.')) host = host.substring(4);
    url.host = host;
    let path = url.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    url.pathname = path;
    return url.toString();
  } catch {
    return urlStr.toLowerCase().trim();
  }
}

export function normalizeTitle(title: string): string {
  // Remove formatting like (Remote), [Remote], - Remote
  let t = title.replace(/\b(remote|hybrid|onsite)\b/gi, '');
  t = t.replace(/[()[\]-]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t.toLowerCase();
}

export async function persistCandidateJob(runId: string, candidate: CandidateJob) {
  const normalizedName = candidate.company.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const companyId = crypto.randomUUID(); 

  // 1. Upsert Company
  const company = await repos.upsertCompany({
    id: companyId,
    normalizedName,
    displayName: candidate.company.name,
    website: candidate.company.website,
    careersUrl: candidate.company.careersUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const canonicalUrl = normalizeUrl(candidate.job.url);
  const normalizedTitle = normalizeTitle(candidate.job.title);

  // 2. Find Exact Match
  let existingJob = await db.select().from(schema.jobs).where(eq(schema.jobs.canonicalUrl, canonicalUrl)).limit(1).get();

  if (!existingJob && candidate.job.externalJobId) {
    // Try external job id via sources
    const srcMatch = await db.select().from(schema.jobSources)
      .where(eq(schema.jobSources.externalJobId, candidate.job.externalJobId))
      .limit(1).get();
    if (srcMatch) {
      existingJob = await db.select().from(schema.jobs).where(eq(schema.jobs.id, srcMatch.jobId)).limit(1).get();
    }
  }

  let job: any;
  const now = new Date().toISOString();

  if (existingJob) {
    // Detect reappearance
    if (existingJob.status !== 'ACTIVE' && candidate.job.status === 'ACTIVE') {
      await emitEvent({
        runId, type: 'JOB_REAPPEARED', stage: 'INGESTION', entityType: 'JOB', entityId: existingJob.id,
        message: `Job reappeared: ${existingJob.canonicalTitle}`
      });
    }

    job = await db.update(schema.jobs).set({
      canonicalTitle: candidate.job.title,
      location: candidate.job.location || existingJob.location,
      remoteType: candidate.job.remoteType || existingJob.remoteType,
      employmentType: candidate.job.employmentType || existingJob.employmentType,
      salaryMin: candidate.compensation?.salaryMin || existingJob.salaryMin,
      salaryMax: candidate.compensation?.salaryMax || existingJob.salaryMax,
      salaryMinOriginal: candidate.compensation?.salaryMinOriginal || existingJob.salaryMinOriginal,
      salaryMaxOriginal: candidate.compensation?.salaryMaxOriginal || existingJob.salaryMaxOriginal,
      salaryCurrencyOriginal: candidate.compensation?.salaryCurrencyOriginal || existingJob.salaryCurrencyOriginal,
      salaryPeriodOriginal: candidate.compensation?.salaryPeriodOriginal || existingJob.salaryPeriodOriginal,
      salaryTextOriginal: candidate.compensation?.salaryTextOriginal || existingJob.salaryTextOriginal,
      candidateRemoteEligibility: candidate.job.candidateRemoteEligibility || existingJob.candidateRemoteEligibility,
      status: candidate.job.status,
      lastSeenAt: now,
      updatedAt: now
    }).where(eq(schema.jobs.id, existingJob.id)).returning().get();
  } else {
    // Insert new job
    const jobId = crypto.randomUUID();
    job = await db.insert(schema.jobs).values({
      id: jobId,
      companyId: company.id,
      canonicalTitle: candidate.job.title,
      normalizedTitle,
      canonicalUrl,
      location: candidate.job.location,
      remoteType: candidate.job.remoteType,
      employmentType: candidate.job.employmentType,
      salaryMin: candidate.compensation?.salaryMin,
      salaryMax: candidate.compensation?.salaryMax,
      salaryCurrency: candidate.compensation?.currency,
      salaryPeriod: candidate.compensation?.period,
      salaryMinOriginal: candidate.compensation?.salaryMinOriginal,
      salaryMaxOriginal: candidate.compensation?.salaryMaxOriginal,
      salaryCurrencyOriginal: candidate.compensation?.salaryCurrencyOriginal,
      salaryPeriodOriginal: candidate.compensation?.salaryPeriodOriginal,
      salaryTextOriginal: candidate.compensation?.salaryTextOriginal,
      candidateRemoteEligibility: candidate.job.candidateRemoteEligibility,
      experienceMin: candidate.experience?.minYears,
      experienceMax: candidate.experience?.maxYears,
      description: candidate.description.summary,
      status: candidate.job.status,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now
    }).returning().get();

    // Check for possible repost
    const potentialMatches = await db.select().from(schema.jobs)
      .where(and(
        eq(schema.jobs.companyId, company.id),
        eq(schema.jobs.normalizedTitle, normalizedTitle)
      ));
    
    const oldMatches = potentialMatches.filter(p => p.id !== job.id);
    if (oldMatches.length > 0) {
      await emitEvent({
        runId, type: 'POSSIBLE_REPOST_DETECTED', stage: 'INGESTION', entityType: 'JOB', entityId: job.id,
        message: `Possible repost of previous jobs: ${oldMatches.map(m => m.id).join(', ')}`
      });
    }
  }

  // 3. Create Job Observation
  await repos.createJobObservation({
    id: crypto.randomUUID(),
    jobId: job.id,
    runId,
    observedAt: now,
    status: candidate.job.status,
    salaryMin: candidate.compensation?.salaryMin,
    salaryMax: candidate.compensation?.salaryMax,
    location: candidate.job.location,
    remoteType: candidate.job.remoteType,
    rawMetadata: JSON.stringify({
      requiredSkills: candidate.description.requiredSkills,
      preferredSkills: candidate.description.preferredSkills
    })
  });

  // 4. Sources
  const sourceIdMap = new Map<string, string>();
  for (const src of (candidate.sources || [])) {
    const srcId = crypto.randomUUID();
    
    // Attempt to parse existing or just insert
    // Multiple observations can insert duplicate sources, we just append or we can upsert by URL
    // For simplicity, we just save the source observation to job_sources
    await repos.saveSource({
      id: srcId,
      jobId: job.id,
      sourceUrl: src.url,
      sourceType: src.type,
      sourceTitle: src.title,
      externalJobId: candidate.job.externalJobId,
      retrievedAt: now
    });
    sourceIdMap.set(src.url, srcId);
  }

  // 5. Evidence
  for (const ev of (candidate.evidence || [])) {
    const srcId = ev.sourceUrl ? sourceIdMap.get(ev.sourceUrl) : undefined;
    await repos.saveEvidence({
      id: crypto.randomUUID(),
      runId,
      sourceId: srcId,
      entityType: 'JOB',
      entityId: job.id,
      field: ev.field,
      valueRepresentation: ev.value,
      evidenceExcerpt: ev.excerpt,
      evidenceType: ev.evidenceType,
      createdAt: now
    });
  }

  return { company, job };
}
