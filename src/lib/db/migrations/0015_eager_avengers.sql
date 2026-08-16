CREATE TABLE `candidate_fit_results` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`run_id` text NOT NULL,
	`score` integer,
	`level` text NOT NULL,
	`dimensions` text,
	`matched_skills` text,
	`missing_skills` text,
	`reasons` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
