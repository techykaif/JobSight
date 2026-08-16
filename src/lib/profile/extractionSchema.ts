import { z } from 'zod';

// A single education record — degree and institution are bound together.
const educationRecordSchema = z.object({
  degree: z.string().describe("The full name of the degree or program, e.g. 'Master of Computer Applications', 'BSc Computer Science', 'Diploma in Software Engineering'."),
  institution: z.string().describe("The full name of the university, college, or institution for THIS specific degree. Never combine institution names from different degrees."),
  fieldOfStudy: z.string().nullable().describe("Major or field of study, e.g. 'Computer Science', 'Information Technology'. Return null if not separately stated."),
  status: z.string().nullable().describe("Enrollment or completion status: 'Pursuing' when currently enrolled or end year is Present/Current, 'Completed' when finished, 'Graduated', 'In Progress', or null if not stated."),
  startYear: z.number().nullable().describe("The EXACT year printed next to THIS specific degree in the EDUCATION SECTION of the resume. Copy verbatim. Do NOT guess, infer, calculate, or borrow from work experience, projects, internships, or another education record. If not explicitly written, return null."),
  endYear: z.number().nullable().describe("The EXACT end year printed next to THIS specific degree in the EDUCATION SECTION. Return null when the program is ongoing ('Present', 'Current', etc.). Do NOT guess, infer, or borrow dates from any other section or record."),
});

export const extractedProfileSchema = z.object({
  identity: z.object({
    summary: z.string().nullable().describe("A brief summary of the candidate's professional background and goals."),
  }),
  experience: z.object({
    yearsOfProfessionalExperience: z.number().nullable().describe("Total years of professional employment experience. Preserve exact fractional durations for short stints (e.g., 0.17 for 2 months). Do not infer from age. Return null if unavailable."),
    roles: z.array(z.string()).describe("List of past or current job titles/roles held."),
    companies: z.array(z.string()).describe("List of past or current companies worked for."),
    notableResponsibilities: z.array(z.string()).describe("Key accomplishments or responsibilities from past experience."),
  }),
  projects: z.object({
    portfolioProjects: z.array(z.string()).describe("Names and brief details of personal or portfolio projects. Do not fabricate projects if none are explicitly present. Never use an experience entry as a substitute project."),
    projectSkills: z.array(z.string()).describe("Specific skills, tools, and technologies used ONLY in personal/portfolio projects. Must be atomic technology names, not full sentences."),
  }).nullable(),
  education: z.array(educationRecordSchema).describe(
    "Array of education records. Each distinct degree/program is a SEPARATE entry. " +
    "Never merge two degrees into one entry. Never merge two institutions into one institution string. " +
    "If the resume has two degrees, return an array with two objects. " +
    "If no education is present, return an empty array."
  ),
  skills: z.object({
    programmingLanguages: z.array(z.string()).describe("Programming languages the candidate knows. Must be atomic atomic technology/tool names."),
    frameworks: z.array(z.string()).describe("Software frameworks, e.g. React, Spring Boot. Must be atomic names."),
    databases: z.array(z.string()).describe("Databases, e.g. PostgreSQL, MongoDB. Must be atomic names."),
    cloudPlatforms: z.array(z.string()).describe("Cloud technologies, e.g. AWS, Docker, Kubernetes. Must be atomic names."),
    tools: z.array(z.string()).describe("Other development tools used. Must be atomic names."),
    otherTechnicalSkills: z.array(z.string()).describe("Any other technical skills not covered above. Must be atomic names."),
  }),
  target: z.object({
    targetRoles: z.array(z.string()).describe("Specific roles the candidate is targeting explicitly from their career/profile context. Do not invent unrelated roles."),
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

export type EducationRecord = z.infer<typeof educationRecordSchema>;
export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;
