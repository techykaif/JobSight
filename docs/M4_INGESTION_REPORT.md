# Milestone 4 — Job Ingestion Vertical Slice Report

## Overview
We successfully implemented and proved the CORE PRODUCT PATH for JobSight by ingesting real public job data via the Antigravity (AGY) CLI in a two-stage process. 

## Process Overview
1. **Hunt Configuration**: Defined via `M4HuntFixture`.
2. **Retrieval (Stage A)**: Used `agy -p` (unstructured) to search the web and discover job listings based on our requirements, producing a raw Markdown research artifact.
3. **Structuring (Stage B)**: Used `agy -p --json-schema` to map the raw research artifact strictly to our expected canonical JSON structure.
4. **Validation**: Enforced rigorous schema validation using Zod (`StructuringOutputSchema`).
5. **Normalization**: Cleaned, extracted, and normalized the output (e.g. converting nested company and job data into database-ready formats).
6. **Persistence**: Saved canonical companies, jobs, job observations, sources, and evidence into our SQLite database.

## Technical Details and Challenges
- We discovered that passing `--json-schema` using a dynamically generated schema from `zod-to-json-schema` failed because the version installed (`3.25.2`) encountered issues resolving Zod's internal schema properties, producing empty schemas `{}`.
- To enforce rigorous schema matching and ensure reliability, we hardcoded the JSON Schema definition directly inside the `runIngestionPipeline` logic. This completely mitigated the schema generation bug.
- Stage B successfully extracted the two sample companies, *Lumanu* and *Canals*, validating the extraction format perfectly.

## Data Persistence Verification
- The SQLite DB properly registered the canonical identities:
  - **Companies**: Lumanu, Canals
  - **Jobs**: Junior Software Engineer, Junior Software Engineer

## Conclusion
The architectural paradigm established in M2 is now fully implemented. The split between **Stage A (Unstructured Retrieval)** and **Stage B (Structured Extraction)** has proven to be an effective strategy for harnessing intelligent web-scraping agents like Antigravity. Milestone 4 is complete.
