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
  'amazon web services': 'AWS'
};

export function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  return SKILL_ALIASES[lower] || skill.trim();
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
