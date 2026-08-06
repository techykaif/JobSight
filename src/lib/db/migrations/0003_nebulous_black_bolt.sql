ALTER TABLE `job_sources` ADD `external_job_id` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `last_checkpoint` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `executor_id` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `heartbeat_at` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `lease_expires_at` text;