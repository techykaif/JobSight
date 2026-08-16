import { describe, it, expect } from 'vitest';
import { evaluateGeographicEligibility } from '../lib/geographic-eligibility/evaluator';

describe('B6 Geographic Eligibility Intelligence', () => {
  it('1. Worldwide remote -> India -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility(null, 'This is a worldwide remote role', 'REMOTE', 'India');
    expect(res.remoteScope).toBe('WORLDWIDE');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('2. India-only remote -> India -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Remote - India', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('3. US-only remote -> India -> NOT_ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Remote - United States', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('NOT_ELIGIBLE');
  });

  it('4. Canada-only remote -> Canada -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Remote - Canada', null, 'REMOTE', 'Canada');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('5. Multi-country remote including India -> India -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Remote - UK, US, India', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('6. Multi-country remote excluding India -> India -> NOT_ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Remote - UK, US, Canada', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('NOT_ELIGIBLE');
  });

  it('7. Canals LATAM case -> India -> NOT_ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Colombia, Argentina, Brazil', 'remote', 'REMOTE', 'India');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('NOT_ELIGIBLE');
  });

  it('8. APAC region -> India -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Remote (APAC)', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('REGION_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('9. LATAM region -> India -> NOT_ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('LATAM', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('REGION_SPECIFIC');
    expect(res.eligibilityStatus).toBe('NOT_ELIGIBLE');
  });

  it('10. vague "Remote" -> NEEDS_VERIFICATION', () => {
    const res = evaluateGeographicEligibility('Remote', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('UNCLEAR');
    expect(res.eligibilityStatus).toBe('NEEDS_VERIFICATION');
  });

  it('11. "Distributed team" without geography -> NEEDS_VERIFICATION', () => {
    const res = evaluateGeographicEligibility(null, 'We are a distributed team', 'REMOTE', 'India');
    expect(res.remoteScope).toBe('UNCLEAR');
    expect(res.eligibilityStatus).toBe('NEEDS_VERIFICATION');
  });

  it('12. onsite India -> India -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Bangalore, India', null, 'ONSITE', 'India');
    expect(res.remoteScope).toBe('ONSITE');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('13. onsite US -> India -> NOT_ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('New York, US', null, 'ONSITE', 'India');
    expect(res.remoteScope).toBe('ONSITE');
    expect(res.eligibilityStatus).toBe('NOT_ELIGIBLE');
  });

  it('14. hybrid India -> India -> ELIGIBLE', () => {
    const res = evaluateGeographicEligibility('Bangalore, India', null, 'HYBRID', 'India');
    expect(res.remoteScope).toBe('HYBRID');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('15. missing location -> NEEDS_VERIFICATION', () => {
    const res = evaluateGeographicEligibility(null, null, null, 'India');
    expect(res.remoteScope).toBe('UNCLEAR');
    expect(res.eligibilityStatus).toBe('NEEDS_VERIFICATION');
  });

  it('16. candidate country is not India', () => {
    const res = evaluateGeographicEligibility('Remote - EMEA', null, 'REMOTE', 'Germany');
    expect(res.remoteScope).toBe('REGION_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('17. country aliases/canonicalization', () => {
    const res = evaluateGeographicEligibility('Remote - US', null, 'REMOTE', 'USA');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('18. case-insensitive location text', () => {
    const res = evaluateGeographicEligibility('remote - INDIA', null, 'REMOTE', 'inDiA');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });

  it('19. explicit exclusion language if supported', () => {
    const res = evaluateGeographicEligibility('Worldwide remote', 'Except India', 'REMOTE', 'India');
    expect(res.remoteScope).toBe('WORLDWIDE');
    expect(res.eligibilityStatus).toBe('NOT_ELIGIBLE');
  });

  it('20. ambiguous abbreviation IN -> Indiana vs India -> NEEDS_VERIFICATION', () => {
    // We removed 'in' from the aliases, so it falls through to vague remote
    const res = evaluateGeographicEligibility('Remote - IN', null, 'REMOTE', 'India');
    expect(res.remoteScope).toBe('UNCLEAR');
    expect(res.eligibilityStatus).toBe('NEEDS_VERIFICATION');
  });

  it('21. ambiguous abbreviation CA -> California vs Canada -> NEEDS_VERIFICATION', () => {
    // We removed 'ca' from Canada's aliases, so it falls through to vague remote
    const res = evaluateGeographicEligibility('Remote - CA', null, 'REMOTE', 'Canada');
    expect(res.remoteScope).toBe('UNCLEAR');
    expect(res.eligibilityStatus).toBe('NEEDS_VERIFICATION');
  });

  it('22. unambiguous abbreviation US -> ELIGIBLE', () => {
    // 'us' is kept as an alias because it rarely overlaps ambiguously in location strings
    const res = evaluateGeographicEligibility('Remote - US', null, 'REMOTE', 'United States');
    expect(res.remoteScope).toBe('COUNTRY_SPECIFIC');
    expect(res.eligibilityStatus).toBe('ELIGIBLE');
  });
});
