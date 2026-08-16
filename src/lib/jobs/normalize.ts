import type { CandidateJob } from './extractionSchema.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function normalizeJobExtraction(candidate: CandidateJob): CandidateJob {
  // Deep clone to avoid mutating original
  const job = JSON.parse(JSON.stringify(candidate)) as CandidateJob;

  // Basic validation: MUST have company name, job title, job URL
  if (!job.company?.name || job.company.name.trim() === '') {
    throw new ValidationError('Missing company name');
  }
  if (!job.job?.title || job.job.title.trim() === '') {
    throw new ValidationError('Missing job title');
  }
  if (!job.job?.url || job.job.url.trim() === '') {
    throw new ValidationError('Missing job url');
  }


  // Trim strings
  job.company.name = job.company.name.trim();
  job.job.title = job.job.title.trim();
  job.job.url = job.job.url.trim();

  // Validate logical bounds
  if (job.compensation) {
    if (job.compensation.salaryMin !== undefined && job.compensation.salaryMin !== null && job.compensation.salaryMax !== undefined && job.compensation.salaryMax !== null) {
      if (job.compensation.salaryMin > job.compensation.salaryMax) {
        throw new ValidationError('salaryMin cannot be greater than salaryMax');
      }
    }
    if (job.compensation.salaryMin && job.compensation.salaryMin < 0) {
      throw new ValidationError('salaryMin cannot be negative');
    }
  }

  if (job.experience) {
    if (job.experience.minYears !== undefined && job.experience.minYears !== null && job.experience.minYears < 0) {
      throw new ValidationError('Experience minYears cannot be negative');
    }
  }

  return job;
}
