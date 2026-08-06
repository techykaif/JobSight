import { z } from 'zod';

export const CandidateProfileSchema = z.object({
  name: z.string(),
  targetRoles: z.array(z.string()),
  skills: z.array(z.string()),
  technologies: z.array(z.string()).optional().default([]),
  yearsOfProfessionalExperience: z.number(),
  projectExperience: z.array(z.string()).nullable().optional(),
  education: z.string().nullable().optional(),
  preferredRoles: z.array(z.string()).nullable().optional(),
  remotePreference: z.enum(['REMOTE_ONLY', 'HYBRID_ACCEPTABLE', 'ONSITE_ACCEPTABLE']).nullable().optional(),
  allowedRegions: z.array(z.string()).nullable().optional(),
  salaryExpectations: z.object({
    minimum: z.number().nullable(),
    preferred: z.number().nullable(),
    currency: z.string()
  }).nullable().optional(),
  employmentPreferences: z.array(z.string()).nullable().optional()
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const HardFilterResultSchema = z.object({
  passed: z.boolean(),
  reasons: z.array(z.string()),
  unknowns: z.array(z.string())
});

export type HardFilterResult = z.infer<typeof HardFilterResultSchema>;

export const DecisionSchema = z.enum(['APPLY', 'CONSIDER', 'SKIP', 'RESEARCH_REQUIRED', 'FAILED']);
export type Decision = z.infer<typeof DecisionSchema>;

export const AgyRequirementAnalysisSchema = z.object({
  experienceStrictness: z.enum(['HARD', 'MODERATE', 'FLEXIBLE', 'UNKNOWN']),
  actualSeniority: z.enum(['ENTRY', 'JUNIOR', 'EARLY_MID', 'MID', 'SENIOR', 'UNKNOWN']),
  responsibilityComplexity: z.enum(['LOW', 'MODERATE', 'HIGH', 'UNKNOWN']),
  portfolioExperienceRelevant: z.boolean().nullable(),
  majorBlockers: z.array(z.string()),
  positiveSignals: z.array(z.string()),
  reasoning: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export type AgyRequirementAnalysis = z.infer<typeof AgyRequirementAnalysisSchema>;

export const QualificationResultSchema = z.object({
  decision: DecisionSchema,
  reasons: z.array(z.string()),
  unknowns: z.array(z.string()),
  scores: z.object({
    resumeMatch: z.number(),
    requirementMatch: z.number(),
    opportunity: z.number(),
    confidence: z.number(),
    extremeExperienceGap: z.boolean().optional()
  }),
  analysis: AgyRequirementAnalysisSchema.nullable()
});

export type QualificationResult = z.infer<typeof QualificationResultSchema>;
