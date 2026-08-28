export const SKILL_ALIASES: Record<string, string> = {
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'react.js': 'React',
  'reactjs': 'React',
  'react': 'React',
  'ts': 'TypeScript',
  'typescript': 'TypeScript',
  'js': 'JavaScript',
  'javascript': 'JavaScript',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'go': 'Go',
  'golang': 'Go',
  'c#': 'C#',
  'csharp': 'C#',
  '.net': '.NET',
  'dotnet': '.NET',
  'mongodb': 'MongoDB',
  'mongo': 'MongoDB',
  'k8s': 'Kubernetes',
  'kubernetes': 'Kubernetes',
  'docker': 'Docker',
};

export function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  return SKILL_ALIASES[lower] || skill.trim();
}

/**
 * Build a normalized Set of candidate skills for O(1) lookup.
 * Merges profile.skills and profile.technologies, deduplicates via alias resolution.
 */
export function buildNormalizedSkillSet(skills: string[], technologies?: string[]): Set<string> {
  const combined = [...(skills || []), ...(technologies || [])];
  return new Set(combined.map(normalizeSkill).map(s => s.toLowerCase()));
}

/**
 * Check whether a normalized candidate skill set contains a given skill.
 * Uses canonical alias resolution — no substring matching.
 */
export function hasNormalizedSkill(normalizedSet: Set<string>, skill: string): boolean {
  return normalizedSet.has(normalizeSkill(skill).toLowerCase());
}

export function matchSkills(candidateSkills: string[], required: string[] = [], preferred: string[] = []) {
  const normCandidate = new Set(candidateSkills.map(normalizeSkill).map(s => s.toLowerCase()));
  
  let requiredMatched = 0;
  let preferredMatched = 0;

  for (const req of required) {
    if (normCandidate.has(normalizeSkill(req).toLowerCase())) {
      requiredMatched++;
    }
  }

  for (const pref of preferred) {
    if (normCandidate.has(normalizeSkill(pref).toLowerCase())) {
      preferredMatched++;
    }
  }

  return {
    requiredTotal: required.length,
    requiredMatched,
    preferredTotal: preferred.length,
    preferredMatched
  };
}
