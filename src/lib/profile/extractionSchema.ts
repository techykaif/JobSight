import { z } from 'zod';

export const extractedProfileSchema = z.object({
  identity: z.object({
    summary: z.string().nullable().describe("A brief summary of the candidate's professional background and goals."),
  }),
  experience: z.object({
    yearsOfProfessionalExperience: z.number().nullable().describe("Total years of professional employment experience. Do not infer from age. Return null if unavailable."),
    roles: z.array(z.string()).describe("List of past or current job titles/roles held."),
    companies: z.array(z.string()).describe("List of past or current companies worked for."),
    notableResponsibilities: z.array(z.string()).describe("Key accomplishments or responsibilities from past experience."),
  }),
  education: z.object({
    degrees: z.array(z.string()).describe("Degrees earned, e.g. 'BSc', 'MSc'"),
    institutions: z.array(z.string()).describe("Names of universities or institutions attended."),
    fieldsOfStudy: z.array(z.string()).describe("Major or field of study, e.g. 'Computer Science'"),
  }),
  skills: z.object({
    programmingLanguages: z.array(z.string()).describe("Programming languages the candidate knows."),
    frameworks: z.array(z.string()).describe("Software frameworks, e.g. React, Spring Boot."),
    databases: z.array(z.string()).describe("Databases, e.g. PostgreSQL, MongoDB."),
    cloudPlatforms: z.array(z.string()).describe("Cloud technologies, e.g. AWS, Docker, Kubernetes."),
    tools: z.array(z.string()).describe("Other development tools used."),
    otherTechnicalSkills: z.array(z.string()).describe("Any other technical skills not covered above."),
  }),
  target: z.object({
    targetRoles: z.array(z.string()).describe("Specific roles the candidate is targeting."),
    preferredJobFamilies: z.array(z.string()).describe("General categories or families of jobs they prefer, e.g. 'Engineering', 'Product Management'."),
  }),
  compensation: z.object({
    salaryExpectations: z.object({
      minimum: z.number().nullable(),
      preferred: z.number().nullable(),
      currency: z.string().nullable(),
      period: z.enum(['YEAR', 'MONTH', 'HOUR']).nullable(),
    }).nullable().describe("ONLY extract if explicitly mentioned in the context. Do not guess or infer."),
  }).nullable(),
  preferences: z.object({
    remotePreference: z.array(z.enum(['REMOTE', 'HYBRID', 'ONSITE'])).nullable().describe("ONLY extract if explicitly mentioned in the context."),
  }).nullable(),
});

export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;
