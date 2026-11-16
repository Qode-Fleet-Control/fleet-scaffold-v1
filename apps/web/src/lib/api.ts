import type { Health } from "@scaffold/shared";

async function toJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// Typed API client. Types come from @scaffold/shared, so a contract change
// surfaces as a type error on both sides.
export const api = {
  health: () => fetch("/api/health").then((r) => toJson<Health>(r)),
};
