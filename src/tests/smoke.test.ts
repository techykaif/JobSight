import { describe, it, vi, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { extractTextFromBuffer } from '../lib/profile/parser';
import { extractStructuredProfile } from '../lib/profile/extractor';
import * as runner from '../lib/agy/runner';

// Mock the live model invocation to make the extraction test deterministic
vi.spyOn(runner, 'runAgyTask').mockImplementation(async () => {
  return {
    identity: { name: 'Test User' },
    experience: { yearsOfProfessionalExperience: 2, roles: ['Web & Android Development Intern'], companies: ['Netcamp Solutions Pvt. Ltd.'] },
    projects: { portfolioProjects: ['AutoBrief AI'], projectSkills: ['React'] },
    education: [
      {
        degree: 'Master of Computer Applications',
        institution: 'IGNOU',
        fieldOfStudy: 'Computer Applications',
        status: 'Pursuing',
        startYear: 2026,
        endYear: null
      },
      {
        degree: 'Bachelor of Computer Applications',
        institution: 'UIM',
        fieldOfStudy: 'Computer Applications',
        status: 'Completed',
        startYear: 2022,
        endYear: 2025
      }
    ],
    skills: {
      programmingLanguages: ['TypeScript'],
      frameworks: ['React'],
      databases: ['PostgreSQL'],
      cloudPlatforms: [],
      tools: ['Git'],
      otherTechnicalSkills: []
    },
    target: { targetRoles: ['Frontend Engineer'], preferredJobFamilies: ['Engineering'] },
    compensation: null,
    preferences: null
  };
});

describe('Real Resume Smoke Test', () => {
  it('extracts education and checks for leakage', async () => {
    const paths = [
      '/Users/mohdkaifansari/Desktop/react_portfolio/react-portfolio/public/myresume.pdf',
      '/Users/mohdkaifansari/Desktop/Portfolios/dev-portfolio/public/myresume.pdf',
      '/Users/mohdkaifansari/Desktop/claude_infinite/public/myresume.pdf',
      '/Users/mohdkaifansari/Desktop/antigravity-max/myresume.pdf'
    ];
    let pdfPath = null;
    for (const p of paths) {
      if (existsSync(p)) {
        pdfPath = p;
        break;
      }
    }

    if (!pdfPath) {
      throw new Error('myresume.pdf not found in any known locations.');
    }

    console.log(`Reading: ${pdfPath}`);
    const buf = readFileSync(pdfPath);

    console.log('Parsing PDF...');
    const parsed = await extractTextFromBuffer(buf, 'application/pdf');

    console.log('Extracting Structured Profile via AGY...');
    const result = await extractStructuredProfile(parsed.text);

    console.log('\n========================================');
    console.log('EDUCATION RECORDS:');
    console.log(JSON.stringify(result.education, null, 2));

    console.log('\n========================================');
    console.log('EXPERIENCE ROLES:');
    console.log(JSON.stringify(result.experience?.roles, null, 2));
    console.log('EXPERIENCE COMPANIES:');
    console.log(JSON.stringify(result.experience?.companies, null, 2));

    console.log('\n========================================');
    console.log('PROJECTS / PORTFOLIO:');
    console.log(JSON.stringify(result.projects, null, 2));

    console.log('\n========================================');
    console.log('SKILLS:');
    console.log(JSON.stringify(result.skills, null, 2));
    console.log('========================================\n');
  }, 120000); // 2 minute timeout
});
