CREATE TABLE `company_opportunity` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`company_id` text NOT NULL,
	`score` integer NOT NULL,
	`level` text NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_outlook` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`company_id` text NOT NULL,
	`trend` text NOT NULL,
	`stability` text NOT NULL,
	`momentum` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`company_id` text NOT NULL,
	`signal_type` text NOT NULL,
	`value` text,
	`weight` integer NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text,
	`company_id` text NOT NULL,
	`outlook` text NOT NULL,
	`hiring_trend` text NOT NULL,
	`remote_hiring` text NOT NULL,
	`engineering_hiring` text NOT NULL,
	`competition` text NOT NULL,
	`authenticity` text NOT NULL,
	`evidence_count` integer NOT NULL,
	`confidence` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
