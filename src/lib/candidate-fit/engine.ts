import crypto from 'crypto';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { CandidateJob } from '../jobs/extractionSchema.js';

export interface CandidateFitSignal {
  score: number;
  level: "strong" | "good" | "partial" | "weak" | "insufficient_evidence";
  dimensions: {
    experience: number | null;
    skills: number | null;
    role: number | null;
  };
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
}

export async function evaluateCandidateFit(
  runId: string,
  jobId: string,
  jobMetadata: CandidateJob
): Promise<CandidateFitSignal | null> {
  const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).limit(1).get();
  
  // Explicitly unavailable if no profile exists
  if (!run || !run.profileSnapshot) {
    return null;
  }

  const snapshot = run.profileSnapshot as any;
  const profile = snapshot.profile;

  const reasons: string[] = [];
  const dimensions: { experience: number | null, skills: number | null, role: number | null } = {
    experience: null,
    skills: null,
    role: null
  };

  // 1. Experience Fit
  const profileExp = profile.yearsOfProfessionalExperience;
  const jobMinExp = jobMetadata.experience?.minYears;
  
  if (typeof profileExp === 'number' && typeof jobMinExp === 'number') {
    if (profileExp >= jobMinExp) {
      dimensions.experience = 100;
      reasons.push(`Candidate has ${profileExp} years of experience, meeting the minimum requirement of ${jobMinExp}.`);
    } else if (profileExp >= jobMinExp - 1) {
      dimensions.experience = 50;
      reasons.push(`Candidate has ${profileExp} years of experience, slightly below the minimum requirement of ${jobMinExp}.`);
    } else {
      dimensions.experience = 0;
      reasons.push(`Candidate has ${profileExp} years of experience, failing to meet the minimum requirement of ${jobMinExp}.`);
    }
  } else if (typeof jobMinExp !== 'number') {
    reasons.push(`Job does not state minimum experience requirements.`);
  } else {
    reasons.push(`Candidate profile lacks experience details.`);
  }

  // 2. Skill Fit
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  
  const profileSkills = Array.isArray(profile.skills) ? profile.skills.map((s: string) => s.toLowerCase().trim()) : [];
  const requiredSkills = Array.isArray(jobMetadata.description?.requiredSkills) 
    ? jobMetadata.description!.requiredSkills.map(s => s.toLowerCase().trim()) 
    : [];

  if (requiredSkills.length > 0) {
    for (const skill of requiredSkills) {
      if (profileSkills.some((ps: string) => ps.includes(skill) || skill.includes(ps))) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }
    
    const matchRatio = matchedSkills.length / requiredSkills.length;
    dimensions.skills = Math.round(matchRatio * 100);
    reasons.push(`Candidate matches ${matchedSkills.length}/${requiredSkills.length} required skills.`);
  } else {
    reasons.push(`Job does not state explicit skill requirements.`);
  }

  // 3. Role Fit
  const profileRoles = Array.isArray(profile.targetRoles) ? profile.targetRoles.map((r: string) => r.toLowerCase().trim()) : [];
  const jobTitle = jobMetadata.job.title.toLowerCase().trim();

  if (profileRoles.length > 0) {
    let roleMatched = false;
    for (const role of profileRoles) {
      if (jobTitle.includes(role) || role.includes(jobTitle)) {
        roleMatched = true;
        break;
      }
    }
    dimensions.role = roleMatched ? 100 : 0;
    if (roleMatched) {
      reasons.push(`Job title aligns with candidate target roles.`);
    } else {
      reasons.push(`Job title does not clearly align with candidate target roles.`);
    }
  } else {
    reasons.push(`Candidate profile lacks target roles.`);
  }

  // Calculate Overall Score
  let totalScore = 0;
  let activeDimensions = 0;

  if (dimensions.experience !== null) { totalScore += dimensions.experience; activeDimensions++; }
  if (dimensions.skills !== null) { totalScore += dimensions.skills; activeDimensions++; }
  if (dimensions.role !== null) { totalScore += dimensions.role; activeDimensions++; }

  let score = 0;
  let level: CandidateFitSignal['level'] = 'insufficient_evidence';

  if (activeDimensions > 0) {
    score = Math.round(totalScore / activeDimensions);
    if (score >= 80) level = 'strong';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'partial';
    else level = 'weak';
  } else {
    reasons.push(`Insufficient metadata to calculate a meaningful candidate fit.`);
  }

  const signal: CandidateFitSignal = {
    score,
    level,
    dimensions,
    matchedSkills,
    missingSkills,
    reasons
  };

  // Persist the signal idempotently
  const existing = await db.select().from(schema.candidateFitResults)
    .where(and(eq(schema.candidateFitResults.runId, runId), eq(schema.candidateFitResults.jobId, jobId)))
    .limit(1).get();

  if (existing) {
    await db.update(schema.candidateFitResults).set({
      score: signal.score,
      level: signal.level,
      dimensions: JSON.stringify(signal.dimensions),
      matchedSkills: JSON.stringify(signal.matchedSkills),
      missingSkills: JSON.stringify(signal.missingSkills),
      reasons: JSON.stringify(signal.reasons),
      updatedAt: new Date().toISOString()
    }).where(eq(schema.candidateFitResults.id, existing.id)).run();
  } else {
    await db.insert(schema.candidateFitResults).values({
      id: crypto.randomUUID(),
      runId,
      jobId,
      score: signal.score,
      level: signal.level,
      dimensions: JSON.stringify(signal.dimensions),
      matchedSkills: JSON.stringify(signal.matchedSkills),
      missingSkills: JSON.stringify(signal.missingSkills),
      reasons: JSON.stringify(signal.reasons),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return signal;
}
