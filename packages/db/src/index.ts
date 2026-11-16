import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// The database is OPTIONAL in this starter: an app that stores no data runs without one.
// To use it, add "@scaffold/db": "*" to apps/api/package.json and import { db } from it;
// Devfab reads that dependency and then requires DATABASE_URL before the app ships.
const connectionString = process.env.DATABASE_URL;

let pool: Pool | undefined;
let instance: ReturnType<typeof drizzle<typeof schema>> | undefined;

function connect() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set: this code uses the database. Set DATABASE_URL (Devfab asks for it " +
        "when apps/api/package.json depends on @scaffold/db).",
    );
  }
  pool ??= new Pool({ connectionString });
  instance ??= drizzle(pool, { schema });
  return instance;
}

// `db` connects on first use, so importing this package never needs a database.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get: (_target, prop) => {
    const real = connect();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export const getPool = () => (connect(), pool as Pool);

export * from "./schema";
