import { defineConfig } from "orval";

// Generates two packages from openapi.yaml:
//   @scaffold/api-zod          — Zod schemas
//   @scaffold/api-client-react — typed React Query hooks (fetch-based)
export default defineConfig({
  zod: {
    input: "./openapi.yaml",
    output: {
      client: "zod",
      mode: "single",
      target: "../api-zod/src/generated/index.ts",
      clean: true,
      prettier: false,
    },
  },
  hooks: {
    input: "./openapi.yaml",
    output: {
      client: "react-query",
      httpClient: "fetch",
      mode: "split",
      baseUrl: "/api",
      target: "../api-client-react/src/generated/api.ts",
      clean: true,
      prettier: false,
    },
  },
});
