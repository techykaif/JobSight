# JobSight AI Job Intelligence System Data Model

This document outlines the data model and storage strategy for the JobSight AI Job Intelligence System, reflecting the implemented canonical local persistence layer (M3).

## STORAGE STRATEGY
- **Primary:** SQLite via `better-sqlite3` + Drizzle ORM
- **Canonical Principle:** Raw AGY output is stored as Research Artifacts, separated strictly from structured, canonical job data.

---

## 1. Core Tables (Implemented in Drizzle)

### `hunt_configs`
Stores the configuration that produced a run. Historical runs retain immutable snapshots of configuration.
- `id`: string (UUID) PRIMARY KEY
- `target_roles`: json (string[]) NOT NULL
- `alternative_roles`: json (string[]) NOT NULL
- `salary_minimum`: integer
- `salary_preferred`: integer
- `currency`: string (Default: 'USD')
- `remote_requirement`: string
- `allowed_regions`: json (string[])
- `experience_preferences`: json (object)
- `required_skills`: json (string[])
- `excluded_companies`: json (string[])
- `created_at`: string (ISO 8601 UTC) NOT NULL
- `updated_at`: string (ISO 8601 UTC) NOT NULL

### `runs`
Represents one job-hunting mission.
- `id`: string (UUID) PRIMARY KEY
- `config_id`: string REFERENCES hunt_configs(id) NOT NULL
- `status`: string NOT NULL (CREATED, PREFLIGHT, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED)
- `current_stage`: string
- `error_summary`: string
- `started_at`: string
- `completed_at`: string
- `paused_at`: string
- `created_at`: string NOT NULL
- `updated_at`: string NOT NULL

### `companies`
Canonical company entity for stable facts.
- `id`: string (UUID) PRIMARY KEY
- `normalized_name`: string NOT NULL UNIQUE
- `display_name`: string NOT NULL
- `website`: string
- `careers_url`: string
- `created_at`: string NOT NULL
- `updated_at`: string NOT NULL

### `jobs`
Logical job opportunity representing canonical truth.
- `id`: string (UUID) PRIMARY KEY
- `company_id`: string REFERENCES companies(id)
- `canonical_title`: string
- `normalized_title`: string
- `canonical_url`: string UNIQUE
- `location`: string
- `remote_type`: string (REMOTE, ONSITE, HYBRID)
- `employment_type`: string
- `salary_min`: integer
- `salary_max`: integer
- `salary_currency`: string
- `salary_period`: string
- `experience_min`: integer
- `experience_max`: integer
- `description`: string
- `first_seen_at`: string NOT NULL
- `last_seen_at`: string NOT NULL
- `status`: string NOT NULL (ACTIVE, INACTIVE, UNKNOWN)
- `created_at`: string NOT NULL
- `updated_at`: string NOT NULL

*Note: Unknown values remain explicitly `null`.*

### `job_observations`
Preserves timestamped observations of a job's state to track changes over time without overwriting history.
- `id`: string (UUID) PRIMARY KEY
- `job_id`: string REFERENCES jobs(id) NOT NULL
- `run_id`: string REFERENCES runs(id)
- `observed_at`: string NOT NULL
- `status`: string
- `salary_min`: integer
- `salary_max`: integer
- `location`: string
- `remote_type`: string
- `raw_metadata`: json

### `job_sources`
Provenance linking jobs to where they were found.
- `id`: string (UUID) PRIMARY KEY
- `job_id`: string REFERENCES jobs(id) NOT NULL
- `source_url`: string NOT NULL
- `source_type`: string NOT NULL (OFFICIAL_JOB_PAGE, ATS, SEARCH_RESULT, etc.)
- `retrieved_at`: string NOT NULL
- `http_status`: integer
- `final_url`: string
- `source_title`: string

### `research_artifacts`
Raw, unstructured output retrieved by Stage A (Retrieval) workers. This is NOT canonical truth.
- `id`: string (UUID) PRIMARY KEY
- `run_id`: string REFERENCES runs(id) NOT NULL
- `entity_type`: string NOT NULL (JOB, COMPANY, MARKET)
- `entity_id`: string
- `worker_type`: string NOT NULL
- `raw_content`: string NOT NULL
- `metadata`: json
- `created_at`: string NOT NULL

### `evidence`
Snippets proving factual claims for auditing purposes.
- `id`: string (UUID) PRIMARY KEY
- `run_id`: string REFERENCES runs(id)
- `source_id`: string REFERENCES job_sources(id)
- `entity_type`: string NOT NULL (JOB, COMPANY)
- `entity_id`: string NOT NULL
- `field`: string NOT NULL
- `value_representation`: string
- `evidence_excerpt`: string
- `evidence_type`: string NOT NULL (FACT, INFERENCE)
- `confidence`: integer
- `created_at`: string NOT NULL

### `job_analysis`
Derived/non-canonical analysis based on inferences and intelligence. Separated from canonical `jobs`.
- `id`: string (UUID) PRIMARY KEY
- `job_id`: string REFERENCES jobs(id) NOT NULL
- `run_id`: string REFERENCES runs(id)
- `experience_flexibility`: string
- `seniority_assessment`: string
- `requirement_difficulty`: string
- `competition_estimate`: string
- `analysis_reasoning`: string
- `analysis_timestamp`: string NOT NULL
- `worker_metadata`: json

### `company_analysis`
Timestamped intelligence about companies (momentum, remote friendliness).
- `id`: string (UUID) PRIMARY KEY
- `company_id`: string REFERENCES companies(id) NOT NULL
- `run_id`: string REFERENCES runs(id)
- `remote_friendliness`: string
- `hiring_momentum`: string
- `growth_signal`: string
- `layoff_signal`: string
- `engineering_hiring_activity`: string
- `research_timestamp`: string NOT NULL

### `scores`
Versionable scores linking a job to a run.
- `id`: string (UUID) PRIMARY KEY
- `job_id`: string REFERENCES jobs(id) NOT NULL
- `run_id`: string REFERENCES runs(id)
- `score_type`: string NOT NULL
- `score_value`: integer NOT NULL
- `scoring_version`: string NOT NULL
- `created_at`: string NOT NULL

### `pipeline_events`
Append-oriented log for live UI updates and run replay.
- `id`: string (UUID) PRIMARY KEY
- `run_id`: string REFERENCES runs(id)
- `timestamp`: string NOT NULL
- `event_type`: string NOT NULL
- `stage`: string
- `entity_type`: string
- `entity_id`: string
- `payload`: json

### `failures`
Queryable tracking of pipeline/worker failures independent of standard events.
- `id`: string (UUID) PRIMARY KEY
- `run_id`: string REFERENCES runs(id)
- `stage`: string
- `worker`: string
- `entity_type`: string
- `entity_id`: string
- `failure_code`: string NOT NULL
- `message`: string NOT NULL
- `attempt`: integer NOT NULL
- `retryable`: boolean NOT NULL
- `resolved`: boolean DEFAULT false NOT NULL
- `created_at`: string NOT NULL
- `resolved_at`: string

---

## 2. Fact vs Inference Separation

The schema strictly separates:
- **Canonical Entities (`jobs`, `companies`)**: Hold verified, structural truth. Unknown values are represented strictly as `null` rather than fabricated defaults (e.g., `remote_type = null` instead of defaulting to ONSITE).
- **Analyses (`job_analysis`, `company_analysis`)**: Hold inferences (e.g., "high hiring momentum" or "flexible requirements").
- **Evidence (`evidence`)**: Connects a specific factual claim to the origin excerpt and source URL for auditing.

---

## 3. ID and Timestamp Conventions
- **IDs**: Uses UUIDs (generated via `crypto.randomUUID()`) to support offline-first and distributed operations smoothly. Database sequence IDs are avoided for core entities.
- **Timestamps**: Stored as ISO 8601 Strings in UTC time.

---

## 4. Uniqueness / Deduplication
Basic unique indexes are in place (`companies.normalized_name`, `jobs.canonical_url`). Advanced deduplication will be addressed in future milestones via observation aggregation.
