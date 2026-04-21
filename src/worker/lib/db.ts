export function tenantClause(tenantId: string | undefined): [string, string[]] {
  return tenantId ? [" AND tenant_id = ?", [tenantId]] : ["", []];
}
