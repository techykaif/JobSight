# JobSight — Phase B6 Geographic Eligibility Intelligence

## Problem
Jobs can have complex geographic constraints ("Worldwide", "US only", "Remote - EMEA", "Bangalore, India", etc.). Previously, geographic eligibility (`candidateRemoteEligibility`) was solely determined by an LLM during the extraction phase, leading to potential inconsistencies, hallucinations, and non-deterministic behavior. We needed ONE authoritative, deterministic geographic eligibility result that safely integrates with downstream recommendation gating without creating a competing source of truth or modifying the `B1-B5` intelligence layer.

## Architecture Decision
B6 Geographic Eligibility is implemented as a deterministic regex-based module (`src/lib/geographic-eligibility/evaluator.ts`) that runs synchronously during the Discovery Ingestion Pipeline (Stage B), exactly *after* the raw job is extracted from the LLM, but *before* normalization and persistence.

This approach makes B6 the **authoritative producer** of the geographic eligibility decision by deterministically overriding the LLM's `candidate.job.candidateRemoteEligibility` field based on a rich set of logic rules. This preserves backwards compatibility with the existing hard-filter contract (`ELIGIBLE`, `NOT_ELIGIBLE`, `UNKNOWN`), while simultaneously persisting new, richer B6 outputs (`geographicRemoteScope`, `geographicEligibilityReason`, `geographicEligibilityConfidence`) to the `jobs` database table for future UI exposure.

## Authoritative Data Source
The candidate's geographic location is sourced exclusively from the `huntConfigs.candidateCountry` database column, which is explicitly supplied via the `config.candidateCountry` parameter injected into the orchestrator's ingestion loop.

## Domain Model
The `jobs` schema and `CandidateJobSchema` were extended with the following rich result fields:

- **geographicRemoteScope**: `WORLDWIDE`, `COUNTRY_SPECIFIC`, `REGION_SPECIFIC`, `UNCLEAR`, `ONSITE`, `HYBRID`
- **geographicEligibilityReason**: Explainable string justification (e.g. "Job is explicitly worldwide remote.")
- **geographicEligibilityConfidence**: `HIGH`, `MEDIUM`, `LOW`
- **candidateRemoteEligibility** (Overridden Legacy Field): `ELIGIBLE`, `NOT_ELIGIBLE`, `UNKNOWN`

## Deterministic Rules
The core logic resides in `evaluateGeographicEligibility()` which canonicalizes candidate country aliases and performs regex boundary scanning against the combined job location string and job description.
1. **Missing Candidate Country**: Immediately returns `NEEDS_VERIFICATION`.
2. **Onsite/Hybrid Checks**: Validates location exact-match to the candidate country. Returns `ELIGIBLE` if matched, `NOT_ELIGIBLE` if another geography is specified.
3. **Worldwide Explicitly**: Detects "work from anywhere", "worldwide". If an exclusion block ("excluding India") is found, returns `NOT_ELIGIBLE`. Otherwise `ELIGIBLE` / `WORLDWIDE`.
4. **Explicit Candidate Mention**: Direct mention yields `ELIGIBLE` / `COUNTRY_SPECIFIC`.
5. **Regional Mapping**: Applies a static `REGION_MAPPING` structure (LATAM, APAC, EMEA, NA, EU). If the job specifies a region containing the candidate country, yields `ELIGIBLE` / `REGION_SPECIFIC`.
6. **Exclusion Check**: Scans `location` for strictly other countries/regions. If found without the candidate's region/country, yields `NOT_ELIGIBLE`.
7. **Vague Remote**: General terms ("fully remote") lacking geography yield `NEEDS_VERIFICATION` / `UNCLEAR`.

## Visibility vs Eligibility Distinction
B6 strictly evaluates *eligibility*. Ineligible jobs (`NOT_ELIGIBLE`) are **not deleted or suppressed** during discovery ingestion. They are simply persisted with their correct `candidateRemoteEligibility` enum value, which guarantees they will be naturally excluded by the downstream Qualification layer via `runHardFilters()` while still being available in the database for potential visibility or debugging.

## Qualification Integration
The existing Qualification engine acts correctly on the mutated legacy field (`candidateRemoteEligibility`). Jobs deemed `NOT_ELIGIBLE` by B6 will fail the geographic gate in `hardFilters.ts`. Jobs returning `NEEDS_VERIFICATION` are safely mapped to `UNKNOWN` to ensure they bypass the strict geographical hard filter, maintaining the existing repository semantics of giving unknowns the benefit of the doubt.

## Test Coverage
- A new dedicated test suite `b6-geographic-eligibility.test.ts` covers 19 discrete scenarios including worldwide scopes, exclusion phrases, region aliases, missing text, country mappings, and hybrid setups.
- Passed 147 pre-existing regression tests (now 166 total passed tests).
- Validated types across the full monorepo (`npm run typecheck`).

## Limitations & Known Ambiguities
- **Static Geographies**: The `REGION_MAPPING` relies on hardcoded alias dictionaries rather than an exhaustive mapping service.
- **Complex Inclusions**: Phrases like "US, Canada, and LATAM except Brazil" are only partially determinable and may trigger a restrictive matching condition resulting in `NOT_ELIGIBLE` for ambiguously stated countries.
- **Location Typos**: Extreme typos in the job description or location string may slip past the regex boundaries.
