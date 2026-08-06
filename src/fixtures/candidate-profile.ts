import type { CandidateProfile } from '../lib/qualification/schema.js';

export const M5CandidateFixture: CandidateProfile = {
  name: 'Alex Developer',
  targetRoles: ['Backend Engineer', 'Software Engineer', 'Full Stack Engineer'],
  skills: ['API Design', 'Database Modeling', 'Testing'],
  technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'React', 'AWS'],
  yearsOfProfessionalExperience: 0, // Fresher
  projectExperience: [
    'Built a scalable REST API using Node.js and PostgreSQL',
    'Deployed serverless functions on AWS Lambda',
    'Created a full-stack job application tracker with React'
  ],
  education: 'B.S. Computer Science',
  preferredRoles: ['Backend Engineer', 'Junior Software Engineer'],
  remotePreference: 'REMOTE_ONLY',
  allowedRegions: ['Worldwide', 'US', 'India'],
  salaryExpectations: {
    minimum: 60000,
    preferred: 90000,
    currency: 'USD'
  },
  employmentPreferences: ['FULL_TIME']
};
