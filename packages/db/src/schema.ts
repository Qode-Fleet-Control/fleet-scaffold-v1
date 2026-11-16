import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Example relational table: nothing in the starter uses it. Replace it with your own tables;
// run `npm run db:generate` then `npm run db:migrate` to apply changes. The app gets a
// database only when apps/api/package.json depends on @scaffold/db (see ../src/index.ts).
export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Zod schemas derived from the table — keeps DB and validation in lockstep.
export const insertNoteSchema = createInsertSchema(notes);
export const selectNoteSchema = createSelectSchema(notes);
