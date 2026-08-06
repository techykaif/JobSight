# Milestone 5: Qualification & Filtering Engine Report

## 1. Milestone Status
**COMPLETED**

The qualification engine successfully implements a hybrid deterministic and AI-assisted filtering system. It reliably evaluates candidates against job requirements without inventing facts.

## 2. Candidate Profile Structure
A persistent local structure exists representing candidate facts independently of jobs.
**Key fields:** `name`, `targetRoles`, `skills`, `technologies`, `yearsOfProfessionalExperience`, `projectExperience`, `education`, `preferredRoles`, `remotePreference`, `allowedRegions`, `salaryExpectations`, `employmentPreferences`.

## 3. Hard Filters Implemented
Deterministic hard filters run before any AI analysis, rejecting jobs when criteria clearly conflict:
*   **Explicitly Excluded Company**
*   **Closed/Inactive Job**
*   **Senior Title Filtering** (e.g. Rejecting "Senior Backend Engineer" for a junior candidate)
*   **Remote Requirement Incompatibility** (e.g. ONSITE rejected when REMOTE_ONLY is required)
*   **Salary Minimum Threshold** (Max salary < expected minimum)

## 4. Experience Model
Professional employment experience is strictly separated from project/portfolio experience. The AGY reasoning step determines the strictness of the job's experience requirements, but deterministic scoring enforces the penalties based on that strictness categorization.

## 5. Skill Matching Model
A robust alias system (`normalizeSkill`) treats equivalent technologies identically (e.g., Node.js === NodeJS, TS === TypeScript). The deterministic skill matcher evaluates Required vs. Preferred skills independently using a Set intersection approach, preventing false positives like "Java" matching "JavaScript".

## 6. Resume Match Formula
*   `Base`: Requirement Match
*   `Preferred Skills`: Up to +15 points based on % match
*   `Project Experience`: +10 points if portfolio experience is relevant

## 7. Requirement Match Formula
*   `Base`: 100
*   `Missing Required Skills`: -15 points per missing skill
*   `Experience Gap`: 
    *   HARD strictness: -40
    *   MODERATE strictness: -20
    *   FLEXIBLE/UNKNOWN: -10

## 8. Opportunity v1 Formula
*   `Base`: Resume Match Score
*   `Remote Fit`: +10
*   `Salary Fit`: +15 (if min salary >= expected preferred)
*   `Blockers`: -20 per major blocker identified by AGY

## 9. Decision Thresholds
*   **SKIP**: Failed hard filter OR Opportunity < 50
*   **RESEARCH_REQUIRED**: Opportunity >= 50 AND Confidence < 0.6
*   **CONSIDER**: Opportunity >= 50 AND Confidence >= 0.6 AND Opportunity < 80
*   **APPLY**: Opportunity >= 80

## 10. Unknown-semantics tests
Explicitly validated that missing salary, missing remote status, and missing experience requirements do *not* trigger hard rejections (unless config explicitly demands it), but instead correctly push the decision towards lower confidence and CONSIDER/RESEARCH_REQUIRED pathways.

## 11. AGY Analysis Behavior
AGY operates purely in *reasoning* mode, providing strict classifications (e.g., `experienceStrictness`, `actualSeniority`) and text rationales. It does *not* decide whether to APPLY/SKIP, and it is explicitly instructed *not* to hallucinate portfolio experience into professional years.

## 12. Determinism Result
The final scores and decision logic (APPLY/CONSIDER/SKIP) are 100% deterministic TypeScript based on the combination of factual data and the structured classifications provided by AGY.

## 13. Schema-Drift Protection Result
Implemented `src/tests/schema-drift.test.ts` to ensure that the canonical Zod schema and the manual JSON schema sent to AGY do not silently diverge.

## 14. Remaining Problems
None identified for the core qualification engine.

## 15. Recommended Milestone 6
Move forward to **Company Intelligence** (to enhance the Opportunity Score with hiring momentum, layoffs, and reviews).
