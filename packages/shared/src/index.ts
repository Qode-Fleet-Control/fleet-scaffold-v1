import { z } from "zod";

/**
 * The shared contract. Both the API and the web client import these schemas,
 * so request/response shapes stay in sync without a codegen step.
 */
export const HealthSchema = z.object({ status: z.string() });
export type Health = z.infer<typeof HealthSchema>;
