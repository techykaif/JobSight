CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_name` text NOT NULL,
	`display_name` text NOT NULL,
	`website` text,
	`careers_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_normalized_name_unique` ON `companies` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `company_analysis` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`run_id` text,
	`remote_friendliness` text,
	`hiring_momentum` text,
	`growth_signal` text,
	`layoff_signal` text,
	`engineering_hiring_activity` text,
	`research_timestamp` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`source_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`value_representation` text,
	`evidence_excerpt` text,
	`evidence_type` text NOT NULL,
	`confidence` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `job_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `failures` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`stage` text,
	`worker` text,
	`entity_type` text,
	`entity_id` text,
	`failure_code` text NOT NULL,
	`message` text NOT NULL,
	`attempt` integer NOT NULL,
	`retryable` integer NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hunt_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`target_roles` text NOT NULL,
	`alternative_roles` text NOT NULL,
	`salary_minimum` integer,
	`salary_preferred` integer,
	`currency` text DEFAULT 'USD',
	`remote_requirement` text,
	`allowed_regions` text,
	`experience_preferences` text,
	`required_skills` text,
	`excluded_companies` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_analysis` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`run_id` text,
	`experience_flexibility` text,
	`seniority_assessment` text,
	`requirement_difficulty` text,
	`competition_estimate` text,
	`analysis_reasoning` text,
	`analysis_timestamp` text NOT NULL,
	`worker_metadata` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`run_id` text,
	`observed_at` text NOT NULL,
	`status` text,
	`salary_min` integer,
	`salary_max` integer,
	`location` text,
	`remote_type` text,
	`raw_metadata` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`http_status` integer,
	`final_url` text,
	`source_title` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`canonical_title` text,
	`normalized_title` text,
	`canonical_url` text,
	`location` text,
	`remote_type` text,
	`employment_type` text,
	`salary_min` integer,
	`salary_max` integer,
	`salary_currency` text,
	`salary_period` text,
	`experience_min` integer,
	`experience_max` integer,
	`description` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_canonical_url_unique` ON `jobs` (`canonical_url`);--> statement-breakpoint
CREATE TABLE `pipeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`timestamp` text NOT NULL,
	`event_type` text NOT NULL,
	`stage` text,
	`entity_type` text,
	`entity_id` text,
	`payload` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `research_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`worker_type` text NOT NULL,
	`raw_content` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text NOT NULL,
	`status` text NOT NULL,
	`current_stage` text,
	`error_summary` text,
	`started_at` text,
	`completed_at` text,
	`paused_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`config_id`) REFERENCES `hunt_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`run_id` text,
	`score_type` text NOT NULL,
	`score_value` integer NOT NULL,
	`scoring_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
