import { z } from 'zod';

export const CompanySourceSchema = z.object({
  url: z.string().url(),
  type: z.enum(['OFFICIAL_WEBSITE', 'OFFICIAL_CAREERS', 'OFFICIAL_ANNOUNCEMENT', 'REGULATORY', 'ATS', 'SOCIAL', 'PUBLICATION', 'JOB_BOARD', 'COMMUNITY', 'OTHER']),
  title: z.string().nullable().optional()
});

export const FactSignalSchema = z.object({
  type: z.enum(['FACT', 'SIGNAL', 'INFERENCE']),
  description: z.string(),
  sourceUrl: z.string().url().nullable().optional(),
  date: z.string().nullable().optional() // ISO string if available
});

export const CompanyResearchSchema = z.object({
  company: z.object({
    name: z.string(),
    officialWebsite: z.string().url().nullable().optional(),
    careersUrl: z.string().url().nullable().optional()
  }),
  companyProfile: z.object({
    employeeCountMin: z.number().nullable().optional(),
    employeeCountMax: z.number().nullable().optional(),
    stage: z.string().nullable().optional(), // e.g. "Series A", "Public"
    foundedYear: z.number().nullable().optional()
  }),
  hiring: z.object({
    currentOpenings: z.number().nullable().optional(),
    engineeringOpenings: z.number().nullable().optional(),
    remoteOpenings: z.number().nullable().optional(),
    recent30dPostings: z.number().nullable().optional(),
    recent90dPostings: z.number().nullable().optional()
  }),
  signals: z.object({
    expansionSignals: z.array(FactSignalSchema),
    contractionSignals: z.array(FactSignalSchema),
    remoteSignals: z.array(FactSignalSchema),
    stabilitySignals: z.array(FactSignalSchema)
  }),
  funding: z.object({
    lastKnownRound: z.string().nullable().optional(),
    amount: z.string().nullable().optional(), // String because it could be "$10M"
    date: z.string().nullable().optional(),
    sourceUrl: z.string().url().nullable().optional()
  }).nullable().optional(),
  layoffs: z.object({
    recentLayoffEvidence: z.array(FactSignalSchema),
    latestKnownLayoffDate: z.string().nullable().optional()
  }).nullable().optional(),
  sources: z.array(CompanySourceSchema).min(1),
  unknownFields: z.array(z.string()).nullable().optional()
});

export type CompanyResearch = z.infer<typeof CompanyResearchSchema>;

// TEMPORARY JSON SCHEMA FOR AGY WORKER TO AVOID ZOD->JSON SCHEMA ISSUES
export const EXTERNAL_AGY_COMPANY_CONTRACT = {
  type: "object",
  properties: {
    company: {
      type: "object",
      properties: {
        name: { type: "string" },
        officialWebsite: { type: "string", format: "uri" },
        careersUrl: { type: "string", format: "uri" }
      },
      required: ["name"]
    },
    companyProfile: {
      type: "object",
      properties: {
        employeeCountMin: { type: "number" },
        employeeCountMax: { type: "number" },
        stage: { type: "string" },
        foundedYear: { type: "number" }
      }
    },
    hiring: {
      type: "object",
      properties: {
        currentOpenings: { type: "number" },
        engineeringOpenings: { type: "number" },
        remoteOpenings: { type: "number" },
        recent30dPostings: { type: "number" },
        recent90dPostings: { type: "number" }
      }
    },
    signals: {
      type: "object",
      properties: {
        expansionSignals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["FACT", "SIGNAL", "INFERENCE"] },
              description: { type: "string" },
              sourceUrl: { type: "string", format: "uri" },
              date: { type: "string" }
            },
            required: ["type", "description"]
          }
        },
        contractionSignals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["FACT", "SIGNAL", "INFERENCE"] },
              description: { type: "string" },
              sourceUrl: { type: "string", format: "uri" },
              date: { type: "string" }
            },
            required: ["type", "description"]
          }
        },
        remoteSignals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["FACT", "SIGNAL", "INFERENCE"] },
              description: { type: "string" },
              sourceUrl: { type: "string", format: "uri" },
              date: { type: "string" }
            },
            required: ["type", "description"]
          }
        },
        stabilitySignals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["FACT", "SIGNAL", "INFERENCE"] },
              description: { type: "string" },
              sourceUrl: { type: "string", format: "uri" },
              date: { type: "string" }
            },
            required: ["type", "description"]
          }
        }
      },
      required: ["expansionSignals", "contractionSignals", "remoteSignals", "stabilitySignals"]
    },
    funding: {
      type: "object",
      properties: {
        lastKnownRound: { type: "string" },
        amount: { type: "string" },
        date: { type: "string" },
        sourceUrl: { type: "string", format: "uri" }
      }
    },
    layoffs: {
      type: "object",
      properties: {
        recentLayoffEvidence: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["FACT", "SIGNAL", "INFERENCE"] },
              description: { type: "string" },
              sourceUrl: { type: "string", format: "uri" },
              date: { type: "string" }
            },
            required: ["type", "description"]
          }
        },
        latestKnownLayoffDate: { type: "string" }
      }
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          type: { type: "string", enum: ["OFFICIAL_WEBSITE", "OFFICIAL_CAREERS", "OFFICIAL_ANNOUNCEMENT", "REGULATORY", "ATS", "SOCIAL", "PUBLICATION", "JOB_BOARD", "COMMUNITY", "OTHER"] },
          title: { type: "string" }
        },
        required: ["url", "type"]
      },
      minItems: 1
    },
    unknownFields: { type: "array", items: { type: "string" } }
  },
  required: ["company", "companyProfile", "hiring", "signals", "sources"],
  additionalProperties: false
};
