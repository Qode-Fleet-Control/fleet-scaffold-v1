import { z } from "zod";

/**
 * The shared contract. Both the API and the web client import these schemas,
 * so request/response shapes stay in sync without a codegen step.
 */
export const NoteSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string(),
  createdAt: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

export const CreateNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().default(""),
});
export type CreateNote = z.infer<typeof CreateNoteSchema>;
