# JobSight

JobSight is an intelligent, local-first job search intelligence system that automates the discovery, extraction, analysis, and scoring of job opportunities against a user's unique profile.

## V1 Release

This is the fully hardened **V1 freeze** of the JobSight pipeline. All core features (Job Discovery, Hard Filters, Qualification Engine, Company Intelligence, Resume Matching, Orchestration, UI) are stable and fully tested for reliability, data integrity, and recovery.

### Key Features
- **Local First**: Your data remains on your machine in `data/jobsight.db`.
- **Intelligent Qualification**: Uses AGY models under the hood, but strictly enforces structured validation to prevent hallucinations.
- **Deterministic Scoring**: Transparent algorithms score opportunities based on resume match, requirements, company momentum, and more.
- **Resilient**: End-to-end mission orchestrator with checkpointing and recovery if failures occur.

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database**:
   ```bash
   npm run db:migrate
   ```

3. **Start the Application**:
   ```bash
   npm run dev
   ```

4. **Run Background Intelligence**:
   Once you've configured your Hunt in the UI dashboard, missions can be kicked off to autonomously crawl, parse, and score jobs.

## Documentation
- [Architecture](docs/ARCHITECTURE.md)
- [Pipeline](docs/PIPELINE.md)
- [Milestones](docs/MILESTONES.md)
- [V1 Test Matrix](docs/V1_TEST_MATRIX.md)
- [Known Limitations](docs/V1_KNOWN_LIMITATIONS.md)
