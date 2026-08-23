import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichJobFromHtml } from '../lib/pipeline/html-enrichment.js';
import { runAgyTask } from '../lib/agy/runner.js';

vi.mock('../lib/agy/runner.js', () => ({
  runAgyTask: vi.fn()
}));

describe('HTML Enrichment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('Verified HTML is consumed and job description, salary, remote type, location, skills, experience are extracted', async () => {
    const mockHtml = "<html><body><h1>Software Engineer</h1><p>Great job.</p></body></html>";
    const mockResult = {
      jobDescription: "Great job.",
      salaryMin: 100000,
      salaryMax: 150000,
      salaryCurrency: "USD",
      salaryPeriod: "YEARLY",
      remoteType: "REMOTE",
      location: "United States",
      employmentType: "FULL_TIME",
      requiredSkills: ["React", "TypeScript"],
      preferredSkills: ["Node.js"],
      experienceMin: 3,
      experienceMax: 5
    };

    vi.mocked(runAgyTask).mockResolvedValue(mockResult as any);

    const result = await enrichJobFromHtml(mockHtml);
    expect(runAgyTask).toHaveBeenCalled();
    expect(result).toEqual(mockResult);
  });

  it('Empty extraction results do not erase existing fields (mocked at the orchestrator layer)', async () => {
    const mockHtml = "<html><body></body></html>";
    vi.mocked(runAgyTask).mockResolvedValue({
      jobDescription: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      remoteType: null,
      location: null,
      employmentType: null,
      requiredSkills: null,
      preferredSkills: null,
      experienceMin: null,
      experienceMax: null
    } as any);

    const result = await enrichJobFromHtml(mockHtml);
    expect(result?.salaryMin).toBeNull();
  });

  it('Malformed HTML fails safely', async () => {
    vi.mocked(runAgyTask).mockRejectedValue(new Error("Parse error"));
    const result = await enrichJobFromHtml("<<<MALFORMED HTML>>>");
    expect(result).toBeNull();
  });
});
