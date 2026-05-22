import type { Bindings } from "../index";
import type { ActorContext } from "../lib/roles";
import type { Db } from "../lib/db";

/**
 * Actor invoking a service call. Re-exported from `lib/roles` so services
 * import a single canonical type. A `null` actor represents anonymous /
 * public callers; system callers (e.g. scheduled worker) construct an
 * `ActorContext` with `superAdmin: true` or rely on dedicated helpers.
 */
export type Actor = ActorContext;

/**
 * Bundle of request-scoped infrastructure that services accept as their
 * first argument. Routes build this from `c` and pass it down. Services
 * never import Hono types.
 */
export type ServiceCtx = {
  env: Bindings;
  db: Db;
  actor: Actor | null;
};

/** Stable error codes services raise; routes map these to HTTP status. */
export type ServiceErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "EXPIRED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  EXPIRED: 410,
  INTERNAL: 500,
};

/**
 * Typed error services throw to signal a non-success outcome. Routes catch
 * `ServiceError` and map `code → HTTP status` via `error.status`. Never
 * leak service errors to non-HTTP callers without inspection — the
 * scheduled worker should branch on `code`, not `status`.
 */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number;
  readonly detail?: unknown;

  constructor(code: ServiceErrorCode, message: string, detail?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.detail = detail;
  }
}
