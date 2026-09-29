import path from "node:path";
import { fileURLToPath } from "node:url";

// CLMS resolves its Journey Artifact Bundles (jab/) and the built web client
// relative to process.cwd(), and several modules load bundles at import time.
// Pin the working directory to apps/api before any of them are evaluated, so the
// API starts correctly from any directory (repo root, bin/, a container WORKDIR).
// Both src/cwd.ts (tsx) and dist/index.mjs (esbuild) sit one level below apps/api.
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
