CREATE TABLE `application_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`recommendation` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `application_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`score` integer NOT NULL,
	`readiness_level` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `application_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`signal_type` text NOT NULL,
	`value` text,
	`weight` integer NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `application_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`strengths` text NOT NULL,
	`weaknesses` text NOT NULL,
	`missing_skills` text NOT NULL,
	`risk_factors` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
