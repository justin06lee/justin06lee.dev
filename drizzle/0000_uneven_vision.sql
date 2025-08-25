CREATE TABLE `hobbies` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`year` integer NOT NULL,
	`tech` text(8192) NOT NULL,
	`repo` text,
	`live` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`year` integer NOT NULL,
	`tech` text(8192) NOT NULL,
	`repo` text,
	`live` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
