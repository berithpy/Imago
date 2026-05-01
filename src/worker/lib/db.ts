import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { Bindings } from "../index";
import * as schema from "./schema";

export function tenantClause(tenantId: string | undefined): [string, string[]] {
  return tenantId ? [" AND tenant_id = ?", [tenantId]] : ["", []];
}

/** Schema-aware Drizzle client type used by services. */
export type Db = DrizzleD1Database<typeof schema>;

/**
 * Construct a request-scoped Drizzle client over the worker's D1 binding.
 * Cheap to call per-request; do not cache across requests because the
 * binding is request-scoped on Workers.
 */
export function getDb(env: Bindings): Db {
  return drizzle(env.DB, { schema });
}

