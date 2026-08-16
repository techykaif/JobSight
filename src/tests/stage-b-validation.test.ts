import { describe, it, expect } from 'vitest';
import { StructuringOutputSchema } from '../lib/jobs/extractionSchema';
import { normalizeJobExtraction } from '../lib/jobs/normalize';

describe('AGY Stage B Schema Validation & Normalization', () => {

  const validPayload = {
    candidates: [
      {
        company: { name: "Diversio Inc." },
        job: {
          candidateRemoteEligibility: "ELIGIBLE",
          location: "Anywhere",
          remoteType: "REMOTE",
          status: "ACTIVE",
          title: "Engineer I",
          url: "https://hasjob.co/diversio.com/6nk8h"
        }
      },
      {
        company: { name: "NinthMoon.ai" },
        job: {
          location: "Anywhere",
          remoteType: "REMOTE",
          status: "ACTIVE",
          title: "Founding Campus Ambassador",
          url: "https://hasjob.co/ninthmoon.ai/ejojo"
        }
      },
      {
        company: { name: "Alex (JobRecruitment.in)" },
        job: {
          location: "Ahmedabad, India",
          status: "ACTIVE",
          title: "Recruitment Platform for Employers & Job Seekers",
          url: "https://hasjob.co/jobrecruitment.in/4yjd1"
        }
      }
    ]
  };

  it('should validate valid Stage B output with multiple candidates (no description)', () => {
    const res = StructuringOutputSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidates).toHaveLength(3);
    }
  });

  it('should handle candidate with candidateRemoteEligibility', () => {
    const res = StructuringOutputSchema.safeParse({
      candidates: [{
        company: { name: "Test" },
        job: { title: "Test", url: "http://test.com", status: "ACTIVE", candidateRemoteEligibility: "ELIGIBLE" }
      }]
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidates[0]?.job.candidateRemoteEligibility).toBe("ELIGIBLE");
    }
  });

  it('should handle candidate without candidateRemoteEligibility', () => {
    const res = StructuringOutputSchema.safeParse({
      candidates: [{
        company: { name: "Test" },
        job: { title: "Test", url: "http://test.com", status: "ACTIVE" }
      }]
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidates[0]?.job.candidateRemoteEligibility).toBeUndefined();
    }
  });

  it('should handle remote job with location "Anywhere"', () => {
    const res = StructuringOutputSchema.safeParse({
      candidates: [{
        company: { name: "Test" },
        job: { title: "Test", url: "http://test.com", status: "ACTIVE", location: "Anywhere", remoteType: "REMOTE" }
      }]
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidates[0]?.job.location).toBe("Anywhere");
      expect(res.data.candidates[0]?.job.remoteType).toBe("REMOTE");
    }
  });

  it('should handle India location', () => {
    const res = StructuringOutputSchema.safeParse({
      candidates: [{
        company: { name: "Test" },
        job: { title: "Test", url: "http://test.com", status: "ACTIVE", location: "Ahmedabad, India" }
      }]
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.candidates[0]?.job.location).toBe("Ahmedabad, India");
    }
  });

  it('should handle validation failure behavior', () => {
    const res = StructuringOutputSchema.safeParse({
      candidates: [{
        company: { name: "Test" },
        job: { title: "Test" } // missing url, status has default but url is required
      }]
    });
    expect(res.success).toBe(false);
  });

  it('should handle multiple candidates where one candidate is malformed', () => {
    const payload = {
      candidates: [
        validPayload.candidates[0],
        {
          company: { name: "Bad Company" },
          job: { status: "ACTIVE" } // missing title, url
        }
      ]
    };
    const res = StructuringOutputSchema.safeParse(payload);
    expect(res.success).toBe(false);
  });

  it('should perform normalization after successful validation', () => {
    const res = StructuringOutputSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
    if (res.success) {
      const candidate1 = res.data.candidates[0];
      if (!candidate1) throw new Error('Missing candidate');
      const normalized = normalizeJobExtraction(candidate1 as any);
      expect(normalized.company.name).toBe("Diversio Inc.");
      expect(normalized.job.title).toBe("Engineer I");
      expect(normalized.job.url).toBe("https://hasjob.co/diversio.com/6nk8h");
      expect(normalized.job.candidateRemoteEligibility).toBe("ELIGIBLE");
      expect(normalized.job.remoteType).toBe("REMOTE");
    }
  });
});
