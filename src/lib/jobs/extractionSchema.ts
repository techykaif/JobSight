import { z } from 'zod';

export const CandidateSourceSchema = z.object({
  url: z.string().url(),
  type: z.enum(['OFFICIAL_JOB_PAGE', 'COMPANY_CAREERS', 'ATS', 'SEARCH_RESULT', 'OTHER']),
  title: z.string().nullable().optional()
});

export const CandidateEvidenceSchema = z.object({
  field: z.string(),
  value: z.string().nullable().optional(),
  excerpt: z.string(),
  evidenceType: z.enum(['FACT', 'INFERENCE']),
  sourceUrl: z.string().url().nullable().optional()
});

export const CandidateJobSchema = z.object({
  company: z.object({
    name: z.string(),
    website: z.string().url().nullable().optional(),
    careersUrl: z.string().url().nullable().optional()
  }),
  job: z.object({
    title: z.string(),
    url: z.string().url(),
    location: z.string().nullable().optional(),
    remoteType: z.enum(['REMOTE', 'HYBRID', 'ONSITE']).nullable().optional(),
    candidateRemoteEligibility: z.enum(['ELIGIBLE', 'NOT_ELIGIBLE', 'UNKNOWN']).nullable().optional(),
    employmentType: z.string().nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'UNKNOWN']).default('ACTIVE'),
    externalJobId: z.string().nullable().optional()
  }),
  compensation: z.object({
    salaryMin: z.number().nullable().optional(), // normalized
    salaryMax: z.number().nullable().optional(), // normalized
    currency: z.string().nullable().optional(), // normalized
    period: z.string().nullable().optional(), // normalized
    salaryMinOriginal: z.number().nullable().optional(),
    salaryMaxOriginal: z.number().nullable().optional(),
    salaryCurrencyOriginal: z.string().nullable().optional(),
    salaryPeriodOriginal: z.string().nullable().optional(),
    salaryTextOriginal: z.string().nullable().optional()
  }).nullable().optional(),
  experience: z.object({
    minYears: z.number().nullable().optional(),
    maxYears: z.number().nullable().optional(),
    rawText: z.string().nullable().optional()
  }).nullable().optional(),
  description: z.object({
    summary: z.string().nullable().optional(),
    requiredSkills: z.array(z.string()).nullable().optional(),
    preferredSkills: z.array(z.string()).nullable().optional()
  }),
  sources: z.array(CandidateSourceSchema).nullable().optional(),
  evidence: z.array(CandidateEvidenceSchema).nullable().optional(),
  unknownFields: z.array(z.string()).nullable().optional()
});

export const StructuringOutputSchema = z.object({
  candidates: z.array(CandidateJobSchema)
});

export type CandidateJob = z.infer<typeof CandidateJobSchema>;
export type StructuringOutput = z.infer<typeof StructuringOutputSchema>;

/**
 * TEMPORARY / EXTERNAL AGY CONTRACT
 * 
 * We use this manual JSON Schema definition to communicate with the AGY worker.
 * Zod to JSON Schema generation fails with the current library version constraints.
 * 
 * IMPORTANT: Zod remains the application validation authority. 
 * Any changes to CandidateJobSchema MUST be reflected here.
 */
export const EXTERNAL_AGY_STRUCTURING_CONTRACT = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: {
            type: "object",
            properties: {
              name: { type: "string" },
              website: { type: "string", format: "uri" },
              careersUrl: { type: "string", format: "uri" }
            },
            required: ["name"]
          },
          job: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string", format: "uri" },
              location: { type: "string" },
              remoteType: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"] },
              candidateRemoteEligibility: { type: "string", enum: ["ELIGIBLE", "NOT_ELIGIBLE", "UNKNOWN"] },
              employmentType: { type: "string" },
              status: { type: "string", enum: ["ACTIVE", "INACTIVE", "UNKNOWN"] },
              externalJobId: { type: "string" }
            },
            required: ["title", "url", "status"]
          },
          compensation: {
            type: "object",
            properties: {
              salaryMin: { type: "number" },
              salaryMax: { type: "number" },
              currency: { type: "string" },
              period: { type: "string" },
              salaryMinOriginal: { type: "number" },
              salaryMaxOriginal: { type: "number" },
              salaryCurrencyOriginal: { type: "string" },
              salaryPeriodOriginal: { type: "string" },
              salaryTextOriginal: { type: "string" }
            }
          },
          experience: {
            type: "object",
            properties: {
              minYears: { type: "number" },
              maxYears: { type: "number" },
              rawText: { type: "string" }
            }
          },
          description: {
            type: "object",
            properties: {
              summary: { type: "string" },
              requiredSkills: { type: "array", items: { type: "string" } },
              preferredSkills: { type: "array", items: { type: "string" } }
            }
          },
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string", format: "uri" },
                type: { type: "string", enum: ["OFFICIAL_JOB_PAGE", "COMPANY_CAREERS", "ATS", "SEARCH_RESULT", "OTHER"] },
                title: { type: "string" }
              },
              required: ["url", "type"]
            }
          }
        },
        required: ["company", "job"]
      }
    }
  },
  required: ["candidates"],
  additionalProperties: false
};
