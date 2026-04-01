/**
 * Appends a row to the admin_log table.
 * Only records what happened and when — no passwords or personal data.
 */
export async function logAdminEvent(
  db: D1Database,
  event: string,
  detail?: string
): Promise<void> {
  await db
    .prepare("INSERT INTO admin_log (event, detail, created_at) VALUES (?, ?, ?)")
    .bind(event, detail ?? null, Math.floor(Date.now() / 1000))
    .run();
}
