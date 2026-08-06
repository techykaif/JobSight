# JOBSight Qualification & Scoring Model

## Hard Filters

Hard filters instantly reject (SKIP) jobs without further analysis if clear incompatibility is found. Jobs with missing critical information are NOT rejected but marked with `unknowns`.

*   **Explicitly Excluded Company:** Reject if company name matches `config.excludedCompanies`.
*   **Closed/Inactive Job:** Reject if status is `INACTIVE`.
*   **Senior Title Filtering:** Reject titles matching senior keywords (Senior, Lead, Principal, etc.) unless the hunt config expects senior roles.
*   **Remote Requirement:** Reject `ONSITE` if hunt requires `REMOTE_ONLY`. If `remoteType` is null, flag as unknown.
*   **Salary Minimum:** Reject if `salaryMax` is strictly below `config.salaryMinimum`. If missing, flag as unknown.

## Requirement strictness (AGY Analysis)

An AGY worker analyzes job requirements using a structured schema to assess:
*   `experienceStrictness`: HARD, MODERATE, FLEXIBLE, UNKNOWN.
*   `actualSeniority`: ENTRY, JUNIOR, EARLY_MID, MID, SENIOR, UNKNOWN.
*   `responsibilityComplexity`: LOW, MODERATE, HIGH, UNKNOWN.
*   `portfolioExperienceRelevant`: boolean
*   `majorBlockers`: list of reasons
*   `positiveSignals`: list of reasons
*   `confidence`: 0.0 - 1.0

It considers the candidate's professional experience separately from their portfolio/project experience.

## Skill Matching

Skills are matched against a normalized alias map (e.g. `node` -> `Node.js`).
*   Matches are case-insensitive set intersections.
*   `requiredMatched` and `preferredMatched` counts are calculated separately.

## Score Calculations (Version: opportunity_v1)

### 1. Confidence Score (0.0 - 1.0)
Measures the completeness of the job information.
*   Base: 0.4
*   +0.2 for salary information
*   +0.1 for remote info
*   +0.1 for location info
*   +0.1 for experience info
*   + (AGY analysis confidence * 0.1)

### 2. Requirement Match Score (0-100)
How well the candidate satisfies explicit requirements.
*   Base: 100
*   -15 points per missing required skill
*   If experience is deficient (candidate < job minimum):
    *   HARD strictness: -40 (and double penalty -80 if gap >= 3 years)
    *   MODERATE strictness: -20 (and double penalty -40 if gap >= 4 years)
    *   FLEXIBLE/UNKNOWN: -10
    *   *Note: If an extreme experience gap is detected (HARD >= 3, MODERATE >= 4, FLEXIBLE >= 5), the final Opportunity score is forcefully capped at 49, ensuring it cannot exceed the CONSIDER threshold.*

### 3. Resume Match Score (0-100)
Overall fit including preferred skills and project relevance.
*   Base: Requirement Match Score
*   + (up to 15 points) based on percentage of preferred skills matched
*   + 10 points if portfolio experience is deemed relevant

### 4. Opportunity Score (0-100)
Composite score incorporating preferences and blockers.
*   Base: Resume Match Score
*   +10 points if remote type aligns with preference
*   +15 points if salary min >= preferred expectation
*   -20 points per major blocker identified by AGY

## Decision Logic
*   **SKIP**: Failed hard filter or Opportunity < 50
*   **RESEARCH_REQUIRED**: Opportunity >= 50 but Confidence < 0.6
*   **CONSIDER**: Opportunity >= 50 and Confidence >= 0.6 (and Opportunity < 80)
*   **APPLY**: Opportunity >= 80
