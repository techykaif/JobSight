CREATE TABLE `confidence_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`confidence_score` integer NOT NULL,
	`factors` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence_items` (
	`id` text PRIMARY KEY NOT NULL,
	`opportunity_evidence_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`observed_value` text,
	`normalized_value` text,
	`weight` integer,
	`confidence` integer,
	`source` text,
	`timestamp` text NOT NULL,
	`metadata` text,
	FOREIGN KEY (`opportunity_evidence_id`) REFERENCES `opportunity_evidence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `evidence_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`opportunity_score` integer,
	`confidence` integer,
	`evidence_checklist` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `observable_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`signal_type` text NOT NULL,
	`observed_value` text,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `opportunity_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`category` text NOT NULL,
	`confidence` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
