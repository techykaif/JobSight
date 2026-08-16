PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`canonical_title` text,
	`normalized_title` text,
	`canonical_url` text NOT NULL,
	`location` text,
	`remote_type` text,
	`candidate_remote_eligibility` text,
	`geographic_remote_scope` text,
	`geographic_eligibility_reason` text,
	`geographic_eligibility_confidence` text,
	`employment_type` text,
	`salary_min` integer,
	`salary_max` integer,
	`salary_currency` text,
	`salary_period` text,
	`salary_min_original` integer,
	`salary_max_original` integer,
	`salary_currency_original` text,
	`salary_period_original` text,
	`salary_text_original` text,
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
INSERT INTO `__new_jobs`("id", "company_id", "canonical_title", "normalized_title", "canonical_url", "location", "remote_type", "candidate_remote_eligibility", "geographic_remote_scope", "geographic_eligibility_reason", "geographic_eligibility_confidence", "employment_type", "salary_min", "salary_max", "salary_currency", "salary_period", "salary_min_original", "salary_max_original", "salary_currency_original", "salary_period_original", "salary_text_original", "experience_min", "experience_max", "description", "first_seen_at", "last_seen_at", "status", "created_at", "updated_at") SELECT "id", "company_id", "canonical_title", "normalized_title", "canonical_url", "location", "remote_type", "candidate_remote_eligibility", "geographic_remote_scope", "geographic_eligibility_reason", "geographic_eligibility_confidence", "employment_type", "salary_min", "salary_max", "salary_currency", "salary_period", "salary_min_original", "salary_max_original", "salary_currency_original", "salary_period_original", "salary_text_original", "experience_min", "experience_max", "description", "first_seen_at", "last_seen_at", "status", "created_at", "updated_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_canonical_url_unique` ON `jobs` (`canonical_url`);