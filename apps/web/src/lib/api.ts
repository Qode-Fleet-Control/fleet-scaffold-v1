import type { CreateNote, Note } from "@scaffold/shared";

async function toJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// Typed API client. Types come from @scaffold/shared, so a contract change
// surfaces as a type error on both sides.
export const api = {
  listNotes: () => fetch("/api/notes").then((r) => toJson<Note[]>(r)),
  createNote: (input: CreateNote) =>
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => toJson<Note>(r)),
  deleteNote: (id: string) =>
    fetch(`/api/notes/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
    }),
};
