import { randomUUID } from "node:crypto";
import { CreateNoteSchema } from "@scaffold/shared";
import { db, notes } from "@scaffold/db";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";

export const notesRouter = Router();

notesRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(notes).orderBy(desc(notes.createdAt));
  res.json(rows);
});

notesRouter.post("/", async (req, res) => {
  const parsed = CreateNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const [row] = await db
    .insert(notes)
    .values({ id: randomUUID(), title: parsed.data.title, body: parsed.data.body })
    .returning();
  res.status(201).json(row);
});

notesRouter.delete("/:id", async (req, res) => {
  await db.delete(notes).where(eq(notes.id, req.params.id));
  res.status(204).end();
});
