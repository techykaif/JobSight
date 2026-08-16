CREATE TABLE `candidate_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`job_id` text NOT NULL,
	`final_decision` text NOT NULL,
	`primary_reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_decisions_run_job_idx` ON `candidate_decisions` (`run_id`,`job_id`);