import type { CandidateProfile } from '../lib/qualification/schema.js';
import { M5CandidateFixture } from './candidate-profile.js';

export const qualificationTestCases = [
  {
    name: 'A. Excellent junior match',
    job: {
      title: 'Junior Software Engineer',
      remoteType: 'REMOTE',
      status: 'ACTIVE',
      salaryMin: 70000,
      salaryMax: 90000,
      experienceMin: 0,
      experienceMax: 2,
      description: {
        requiredSkills: ['Node.js', 'PostgreSQL', 'TypeScript'],
        preferredSkills: ['AWS']
      }
    }
  },
  {
    name: 'B. 3-year stretch role with flexible wording',
    job: {
      title: 'Software Engineer',
      remoteType: 'REMOTE',
      status: 'ACTIVE',
      experienceMin: 3,
      description: {
        requiredSkills: ['Node.js', 'React'],
        preferredSkills: ['TypeScript']
      }
    }
  },
  {
    name: 'C. Explicit senior role',
    job: {
      title: 'Senior Backend Engineer',
      remoteType: 'REMOTE',
      status: 'ACTIVE',
      experienceMin: 5
    }
  },
  {
    name: 'D. Salary below hard minimum',
    job: {
      title: 'Junior Software Engineer',
      status: 'ACTIVE',
      salaryMax: 40000 // Profile needs 60k
    }
  },
  {
    name: 'E. Location incompatible',
    job: {
      title: 'Software Engineer',
      remoteType: 'ONSITE',
      status: 'ACTIVE'
    }
  },
  {
    name: 'F. Missing salary',
    job: {
      title: 'Backend Engineer',
      remoteType: 'REMOTE',
      status: 'ACTIVE',
      description: { requiredSkills: ['Node.js', 'TypeScript'] }
    }
  },
  {
    name: 'G. Missing remote status',
    job: {
      title: 'Software Engineer',
      status: 'ACTIVE',
      description: { requiredSkills: ['TypeScript', 'React'] }
    }
  },
  {
    name: 'H. Strong skill match but excessive experience requirement',
    job: {
      title: 'Software Engineer',
      status: 'ACTIVE',
      remoteType: 'REMOTE',
      experienceMin: 8,
      description: { requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'React', 'AWS'] }
    }
  },
  {
    name: 'I. Weak skill match but correct title',
    job: {
      title: 'Junior Software Engineer',
      status: 'ACTIVE',
      remoteType: 'REMOTE',
      experienceMin: 0,
      description: { requiredSkills: ['Java', 'Spring Boot', 'Oracle'] }
    }
  },
  {
    name: 'J. Preferred skills missing but required skills satisfied',
    job: {
      title: 'Software Engineer',
      status: 'ACTIVE',
      remoteType: 'REMOTE',
      experienceMin: 1,
      description: {
        requiredSkills: ['TypeScript', 'React'],
        preferredSkills: ['GraphQL', 'Docker', 'Kubernetes']
      }
    }
  }
];
