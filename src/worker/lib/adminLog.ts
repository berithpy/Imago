import type { ActorContext, ActorType } from "./roles";
import { classifyActor } from "./roles";

export type AdminLogOptions = {
  detail?: string | null;
  actor?: ActorContext | null;
  /** Tenant the action affected. */
  tenantId?: string | null;
  /** Parent of `tenantId`, used to classify parent-operator writes. */
  tenantParentId?: string | null;
  /**
   * If set, surfaces this row to the affected tenant's log view in addition
   * to whoever owns the actor's tenant. Defaults to `tenantId` for
   * imago_operator and parent_operator writes (per spec).
   */
  visibleToTenantId?: string | null;
  /** Override the auto-classified actor_type. Rarely needed. */
  actorTypeOverride?: ActorType;
};

/**
 * Appends a row to the admin_log table. Captures actor, tenant scope, and
 * cross-tenant visibility so the affected tenant can audit imago/parent
 * operator writes.
 *
 * Three call shapes are supported:
 *   logAdminEvent(db, "EVENT")
 *   logAdminEvent(db, "EVENT", "detail-string")    // legacy shorthand
 *   logAdminEvent(db, "EVENT", { actor, tenantId, ... })
 */
export async function logAdminEvent(
  db: D1Database,
  event: string,
  detailOrOptions?: string | AdminLogOptions
): Promise<void> {
  const opts: AdminLogOptions =
    typeof detailOrOptions === "string"
      ? { detail: detailOrOptions }
      : detailOrOptions ?? {};

  const actor = opts.actor ?? null;
  const tenantId = opts.tenantId ?? null;
  const tenantParentId = opts.tenantParentId ?? null;
  const actorType =
    opts.actorTypeOverride ?? classifyActor(actor, tenantId, tenantParentId);

  // Spec: imago_operator and parent_operator writes are visible to the
  // affected tenant. Default `visibleToTenantId` to the tenantId in those
  // cases unless caller overrode it.
  const visibleToTenantId =
    opts.visibleToTenantId !== undefined
      ? opts.visibleToTenantId
      : actorType === "imago_operator" || actorType === "parent_operator"
        ? tenantId
        : null;

  await db
    .prepare(
      `INSERT INTO admin_log
         (event, detail, actor_type, actor_user_id, tenant_id, visible_to_tenant_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event,
      opts.detail ?? null,
      actorType,
      actor?.user?.id ?? null,
      tenantId,
      visibleToTenantId,
      Math.floor(Date.now() / 1000)
    )
    .run();
}
