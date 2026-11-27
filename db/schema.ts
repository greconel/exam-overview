import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Generic key/value store for progress: status of parts, understanding, renamed labels.
export const progress = pgTable("progress", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Own extra tasks added by the user.
export const tasks = pgTable("tasks", {
  id: serial().primaryKey(),
  title: text().notNull(),
  course: text().notNull().default(""),
  done: boolean().notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
