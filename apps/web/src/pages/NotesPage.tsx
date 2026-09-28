import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function NotesPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const notes = useQuery({ queryKey: ["notes"], queryFn: api.listNotes });
  const create = useMutation({
    mutationFn: api.createNote,
    onSuccess: () => {
      setTitle("");
      void qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate({ title: title.trim(), body: "" });
        }}
        className="flex gap-2"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New note…"
          aria-label="Note title"
        />
        <Button type="submit" disabled={create.isPending}>
          Add
        </Button>
      </form>

      {notes.isLoading ? (
        <p className="text-[var(--color-muted-foreground)]">Loading…</p>
      ) : notes.isError ? (
        <p className="text-[var(--color-destructive)]">
          Failed to load. Is the API running on :5000?
        </p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-[var(--color-border)] p-0">
            {notes.data && notes.data.length > 0 ? (
              notes.data.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <span>{n.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${n.title}`}
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="text-[var(--color-destructive)]" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="px-4 py-3 text-[var(--color-muted-foreground)]">
                No notes yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
