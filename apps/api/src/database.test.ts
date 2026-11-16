import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Devfab decides whether this app needs a database from apps/api/package.json: depending on
// @scaffold/db means "this app stores data", and Devfab then asks for DATABASE_URL before it
// ships. npm workspaces would let the API import @scaffold/db without declaring it, so the app
// would ship with no database and fail on its first query. This test keeps the two in step.
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe("database dependency", () => {
  it("declares @scaffold/db in package.json whenever the API imports it", () => {
    const root = path.resolve(__dirname, "..");
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const uses = sources(path.join(root, "src")).filter((f) =>
      /from\s+["']@scaffold\/db(?:\/[^"']*)?["']|require\(["']@scaffold\/db/.test(fs.readFileSync(f, "utf8")),
    );
    if (uses.length > 0) {
      expect(
        pkg.dependencies?.["@scaffold/db"],
        `${uses.map((f) => path.relative(root, f)).join(", ")} import @scaffold/db: add "@scaffold/db": "*" to apps/api/package.json dependencies`,
      ).toBeDefined();
    }
  });
});
