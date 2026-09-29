import { defineConfig } from "drizzle-kit";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "./src/schema";

// CLMS also creates tables from packages/db/sql and at API startup. Restrict
// drizzle-kit to the tables it owns so `push` never proposes dropping those.
const tablesFilter = Object.values(schema as Record<string, unknown>)
  .filter((value): value is PgTable => value instanceof PgTable)
  .map((table) => getTableConfig(table).name);

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  tablesFilter,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
