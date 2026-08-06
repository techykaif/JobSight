ALTER TABLE `hunt_configs` ADD `candidate_country` text;--> statement-breakpoint
ALTER TABLE `hunt_configs` ADD `search_scope` text;--> statement-breakpoint
ALTER TABLE `hunt_configs` ADD `require_salary_disclosure` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `hunt_configs` ADD `minimum_desired_salary` integer;--> statement-breakpoint
ALTER TABLE `hunt_configs` ADD `desired_salary_currency` text DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE `hunt_configs` ADD `desired_salary_period` text DEFAULT 'MONTH';--> statement-breakpoint
ALTER TABLE `hunt_configs` ADD `maximum_usable_results` integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE `jobs` ADD `candidate_remote_eligibility` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_min_original` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_max_original` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_currency_original` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_period_original` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salary_text_original` text;