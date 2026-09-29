import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

// Applies the hand-written SQL in ../sql (carried over from CLMS) after
// `db:push` has created the Drizzle-managed tables. Each file is idempotent
// (IF NOT EXISTS / ON CONFLICT) and is recorded so it only runs once.
const sqlDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../sql");
const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/clms";

const pool = new Pool({ connectionString });

async function main() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS _sql_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (await pool.query<{ name: string }>("SELECT name FROM _sql_migrations")).rows.map((r) => r.name),
  );
  const files = fs.readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      // Files manage their own BEGIN/COMMIT; record separately once they succeed.
      await client.query(fs.readFileSync(path.join(sqlDir, file), "utf8"));
      await client.query("INSERT INTO _sql_migrations (name) VALUES ($1)", [file]);
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error(`Failed applying ${file}: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
