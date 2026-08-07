CREATE TABLE `competition_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`score` integer NOT NULL,
	`level` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `competition_signals` (
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
CREATE TABLE `competition_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`job_id` text NOT NULL,
	`reasons` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
