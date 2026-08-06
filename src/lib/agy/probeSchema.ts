import { z } from 'zod';

export const WebSearchSchema = z.object({
  ceo_name: z.string().nullable(),
  source_url: z.string().nullable(),
  source_type: z.string().nullable(),
  retrieval_status: z.string()
});

export const DirectUrlSchema = z.object({
  heading: z.string().nullable(),
  source_url: z.string().nullable(),
  status: z.string()
});

export const ATSJobSchema = z.object({
  company: z.string().nullable(),
  job_title: z.string().nullable(),
  location: z.string().nullable(),
  remote_status: z.string().nullable(),
  employment_type: z.string().nullable(),
  experience_requirements: z.string().nullable(),
  salary: z.string().nullable(),
  application_url: z.string().nullable(),
  source_url: z.string().nullable(),
  evidence_type: z.string() // DIRECT_PAGE, SEARCH_SNIPPET, INFERENCE, UNKNOWN
});

export const HallucinationSchema = z.object({
  salary: z.string().nullable(),
  experience_requirements: z.string().nullable(),
  remote_status: z.string().nullable(),
  status: z.string()
});

export const InvalidUrlSchema = z.object({
  status: z.string(),
  error_message: z.string().nullable()
});
