CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`run_id` text,
	`decision` text NOT NULL,
	`reasons` text,
	`unknowns` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`years_of_professional_experience` integer NOT NULL,
	`education` text,
	`target_roles` text NOT NULL,
	`skills` text NOT NULL,
	`project_experience` text,
	`preferred_roles` text,
	`salary_expectations` text,
	`remote_preference` text,
	`allowed_regions` text,
	`employment_preferences` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
