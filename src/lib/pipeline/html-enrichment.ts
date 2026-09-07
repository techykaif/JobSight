import { z } from 'zod';
import { runAgyTask } from '../agy/runner.js';

export const HtmlEnrichmentSchema = z.object({
  jobDescription: z.string().nullable().describe("The full extracted job description"),
  salaryMin: z.number().nullable().describe("Minimum salary as a number"),
  salaryMax: z.number().nullable().describe("Maximum salary as a number"),
  salaryCurrency: z.string().nullable().describe("Salary currency (e.g., USD, EUR)"),
  salaryPeriod: z.enum(['YEARLY', 'MONTHLY', 'HOURLY']).nullable().describe("Salary period"),
  remoteType: z.enum(['REMOTE', 'HYBRID', 'ONSITE']).nullable().describe("Extracted remote type"),
  location: z.string().nullable().describe("Extracted location or eligible countries/regions"),
  employmentType: z.string().nullable().describe("Extracted employment type"),
  requiredSkills: z.array(z.string()).nullable().describe("Required skills list"),
  preferredSkills: z.array(z.string()).nullable().describe("Preferred skills list"),
  experienceMin: z.number().nullable().describe("Minimum required years of experience"),
  experienceMax: z.number().nullable().describe("Maximum allowed years of experience, if stated"),
  postingDate: z.string().nullable().describe("ISO 8601 posting date if explicitly stated or present in JSON-LD. Null if inferred or missing")
});

export type HtmlEnrichmentResult = z.infer<typeof HtmlEnrichmentSchema>;

export async function enrichJobFromHtml(
  htmlContent: string,
  abortSignal?: AbortSignal
): Promise<HtmlEnrichmentResult | null> {
  const prompt = `
Extract structured job information from the following HTML source.
Return null for fields that are not explicitly stated or cannot be confidently extracted.
Do not invent or infer data. Do not use external knowledge.

Source HTML (truncated if too long):
${htmlContent.substring(0, 15000)}
`;

  try {
    const r = await runAgyTask({
      prompt,
      schema: HtmlEnrichmentSchema,
      jsonSchemaDef: {
        type: "object",
        properties: {
          jobDescription: { type: "string", nullable: true },
          salaryMin: { type: "number", nullable: true },
          salaryMax: { type: "number", nullable: true },
          salaryCurrency: { type: "string", nullable: true },
          salaryPeriod: { type: "string", enum: ["YEARLY", "MONTHLY", "HOURLY"], nullable: true },
          remoteType: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"], nullable: true },
          location: { type: "string", nullable: true },
          employmentType: { type: "string", nullable: true },
          requiredSkills: { type: "array", items: { type: "string" }, nullable: true },
          preferredSkills: { type: "array", items: { type: "string" }, nullable: true },
          experienceMin: { type: "number", nullable: true },
          experienceMax: { type: "number", nullable: true },
          postingDate: { type: "string", nullable: true }
        },
        required: [
          "jobDescription", "salaryMin", "salaryMax", "salaryCurrency", "salaryPeriod",
          "remoteType", "location", "employmentType", "requiredSkills", "preferredSkills",
          "experienceMin", "experienceMax", "postingDate"
        ]
      },
      timeoutMs: 60000,
      maxAttempts: 2,
      ...(abortSignal ? { abortSignal } : {})
    }); return r;
  } catch (error) {
    console.error('[HTML_ENRICHMENT_FAILED]', error);
    return null;
  }
}
