export interface GeographicEligibilityResult {
  remoteScope: 'WORLDWIDE' | 'COUNTRY_SPECIFIC' | 'REGION_SPECIFIC' | 'UNCLEAR' | 'ONSITE' | 'HYBRID';
  eligibilityStatus: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'NEEDS_VERIFICATION';
  eligibilityConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  eligibilityReason: string;
}

const REGION_MAPPING: Record<string, string[]> = {
  'apac': ['india', 'singapore', 'australia', 'japan', 'china', 'philippines', 'vietnam', 'thailand', 'malaysia', 'new zealand'],
  'latam': ['colombia', 'argentina', 'brazil', 'mexico', 'chile', 'peru', 'uruguay', 'costa rica'],
  'emea': ['europe', 'middle east', 'africa', 'uk', 'germany', 'france', 'spain', 'italy', 'netherlands', 'sweden', 'poland', 'ireland', 'united kingdom'],
  'north america': ['us', 'usa', 'united states', 'canada'],
  'eu': ['europe', 'germany', 'france', 'spain', 'italy', 'netherlands', 'sweden', 'poland', 'ireland', 'european union']
};

export function evaluateGeographicEligibility(
  jobLocation: string | null | undefined,
  jobDescription: string | null | undefined,
  remoteType: string | null | undefined,
  candidateCountryRaw: string | null | undefined
): GeographicEligibilityResult {
  const candidateCountry = (candidateCountryRaw || '').trim().toLowerCase();
  const loc = (jobLocation || '').toLowerCase();
  const desc = (jobDescription || '').toLowerCase();
  const text = `${loc} ${desc}`;

  if (!candidateCountry) {
    return {
      remoteScope: 'UNCLEAR',
      eligibilityStatus: 'NEEDS_VERIFICATION',
      eligibilityConfidence: 'LOW',
      eligibilityReason: 'Candidate country is not configured.'
    };
  }

  // Exact word boundary match for candidate country
  let isCandidateCountryMentioned = new RegExp(`\\b(?:${candidateCountry})\\b`, 'i').test(text);

  // 3. Region checks & Aliases
  let candidateRegion: string | null = null;
  let candidateAliases: string[] = [];
  for (const [region, countries] of Object.entries(REGION_MAPPING)) {
    if (countries.includes(candidateCountry) || region === candidateCountry) {
      candidateRegion = region;
      candidateAliases = countries;
      break;
    }
  }

  // Check aliases (e.g. if candidate is "USA", match "US")
  if (!isCandidateCountryMentioned && candidateAliases.length > 0) {
     isCandidateCountryMentioned = candidateAliases.some(alias => new RegExp(`\\b${alias}\\b`, 'i').test(text));
  }

  if (remoteType === 'ONSITE' || remoteType === 'HYBRID') {
    if (loc.includes(candidateCountry) || candidateAliases.some(alias => loc.includes(alias))) {
      return {
        remoteScope: remoteType as 'ONSITE' | 'HYBRID',
        eligibilityStatus: 'ELIGIBLE',
        eligibilityConfidence: 'HIGH',
        eligibilityReason: `Job is ${remoteType} and explicitly mentions ${candidateCountry}.`
      };
    } else if (loc && loc.length > 2) {
      return {
        remoteScope: remoteType as 'ONSITE' | 'HYBRID',
        eligibilityStatus: 'NOT_ELIGIBLE',
        eligibilityConfidence: 'HIGH',
        eligibilityReason: `Job is ${remoteType} and located in ${jobLocation}, which does not match ${candidateCountry}.`
      };
    } else {
      return {
        remoteScope: remoteType as 'ONSITE' | 'HYBRID',
        eligibilityStatus: 'NEEDS_VERIFICATION',
        eligibilityConfidence: 'LOW',
        eligibilityReason: `Job is ${remoteType} but no location is specified.`
      };
    }
  }

  // Handle Remote / Vague
  if (remoteType === 'REMOTE' || text.includes('remote') || text.includes('distributed team')) {

    // 1. Worldwide check
    if (/worldwide|work from anywhere|anywhere in the world|remote\s*[-–—:]\s*global/i.test(text)) {
      const exclusionRegex = new RegExp(`(?:except|excluding|not including|outside of)\\s+(?:.*?\\s+)?(?:${candidateCountry}|${candidateAliases.join('|')})`, 'i');
      if (exclusionRegex.test(text)) {
        return {
          remoteScope: 'WORLDWIDE',
          eligibilityStatus: 'NOT_ELIGIBLE',
          eligibilityConfidence: 'HIGH',
          eligibilityReason: `Job is worldwide remote but explicitly excludes ${candidateCountry}.`
        };
      }
      return {
        remoteScope: 'WORLDWIDE',
        eligibilityStatus: 'ELIGIBLE',
        eligibilityConfidence: 'HIGH',
        eligibilityReason: 'Job is explicitly worldwide remote.'
      };
    }

    // 2. Explicit Candidate Mention check
    if (isCandidateCountryMentioned) {
      return {
        remoteScope: 'COUNTRY_SPECIFIC',
        eligibilityStatus: 'ELIGIBLE',
        eligibilityConfidence: 'HIGH',
        eligibilityReason: `Job explicitly mentions ${candidateCountry} as eligible.`
      };
    }

    // If region explicitly mentioned
    if (candidateRegion) {
      const regionMentions = {
        apac: /apac|asia pacific/i.test(text),
        latam: /latam|latin america/i.test(text),
        emea: /emea/i.test(text),
        'north america': /north america/i.test(text),
        eu: /eu|european union/i.test(text)
      };

      if (regionMentions[candidateRegion as keyof typeof regionMentions]) {
        return {
          remoteScope: 'REGION_SPECIFIC',
          eligibilityStatus: 'ELIGIBLE',
          eligibilityConfidence: 'HIGH',
          eligibilityReason: `Job is open to ${candidateRegion.toUpperCase()} which includes ${candidateCountry}.`
        };
      }
    }

    // 4. Exclusion checks (other specific countries or regions mentioned in the location field)
    // We only restrict based on `loc` to avoid false positives from `description`
    if (loc && loc.trim() !== 'remote' && loc.trim() !== 'fully remote' && !loc.toLowerCase().includes('worldwide')) {
      const allKnownCountriesAndRegions = Object.values(REGION_MAPPING).flat().concat(Object.keys(REGION_MAPPING));
      const mentionedGeo = allKnownCountriesAndRegions.find(geo => new RegExp(`\\b${geo}\\b`, 'i').test(loc));

      if (mentionedGeo) {
        const isRegion = Object.keys(REGION_MAPPING).includes(mentionedGeo);
        return {
          remoteScope: isRegion ? 'REGION_SPECIFIC' : 'COUNTRY_SPECIFIC',
          eligibilityStatus: 'NOT_ELIGIBLE',
          eligibilityConfidence: 'HIGH',
          eligibilityReason: `Job explicitly restricts remote work to ${jobLocation}; candidate country is ${candidateCountry}.`
        };
      }
    }

    // 5. Vague Remote check
    if (/\b(distributed team|remote|fully remote|work remotely)\b/.test(text)) {
      return {
        remoteScope: 'UNCLEAR',
        eligibilityStatus: 'NEEDS_VERIFICATION',
        eligibilityConfidence: 'MEDIUM',
        eligibilityReason: 'Job is described as remote but does not specify an eligible country or region.'
      };
    }

    return {
      remoteScope: 'UNCLEAR',
      eligibilityStatus: 'NEEDS_VERIFICATION',
      eligibilityConfidence: 'LOW',
      eligibilityReason: 'Job is remote but location evidence is vague.'
    };
  }

  // Missing location entirely
  return {
    remoteScope: 'UNCLEAR',
    eligibilityStatus: 'NEEDS_VERIFICATION',
    eligibilityConfidence: 'LOW',
    eligibilityReason: 'No useful geographic evidence.'
  };
}
