import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { cardStyle, inputStyle, accentButtonStyle, ghostButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

type Tenant = {
  id: string;
  slug: string;
  name: string;
  organization_id: string | null;
  deleted_at: number | null;
  created_at: number;
};

type User = {
  id: string;
  name: string;
  email: string;
  is_super_admin: number;
  createdAt: number;
  role?: string | null;
  tenant_id?: string | null;
  tenant_name?: string | null;
};

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function SlugIndicator({ status }: { status: SlugStatus }) {
  if (status === "checking") return <span style={{ fontSize: "0.78rem", color: "var(--color-text-muted)" }}>Checking…</span>;
  if (status === "available") return <span style={{ fontSize: "0.78rem", color: "var(--color-accent)" }}>✓ Available</span>;
  if (status === "taken") return <span style={{ fontSize: "0.78rem", color: "#e05c5c" }}>✗ Already in use</span>;
  if (status === "invalid") return <span style={{ fontSize: "0.78rem", color: "#e05c5c" }}>✗ Only lowercase letters, numbers, dashes</span>;
  return null;
}

async function checkTenantSlug(slug: string): Promise<SlugStatus> {
  if (!slug) return "idle";
  const res = await fetch(`/api/admin/tenants/check-slug?slug=${encodeURIComponent(slug)}`);
  const data = await res.json() as { valid: boolean; available: boolean };
  if (!data.valid) return "invalid";
  return data.available ? "available" : "taken";
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tenantFilter, setTenantFilter] = useState<string>("");

  // Create form
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugStatus, setCreateSlugStatus] = useState<SlugStatus>("idle");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createSlugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit state: tenantId → { name, slug }
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSlugStatus, setEditSlugStatus] = useState<SlugStatus>("idle");
  const editSlugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  // Auth check
  useEffect(() => {
    authClient.getSession({ fetchOptions: { credentials: "include" } }).then(({ data }) => {
      if (!data?.session) { navigate("/admin/login", { replace: true }); return; }
      // Verify super-admin by attempting to load tenants. If the signed-in
      // user is authenticated but lacks super-admin (e.g. a pre-multitenant
      // single-admin install where the migration left is_super_admin = 0),
      // sign them out and surface an explicit error instead of bouncing
      // back to /admin (which would loop: dashboard 403 → login → dashboard).
      fetch("/api/admin/tenants", { credentials: "include" })
        .then(async (r) => {
          if (r.status === 403) {
            await authClient.signOut({ fetchOptions: { credentials: "include" } });
            navigate("/admin/login?error=not-authorized", { replace: true });
            return null;
          }
          return r.json() as Promise<{ tenants: Tenant[] }>;
        })
        .then((d) => {
          if (!d) return;
          setTenants(d.tenants ?? []);
          setTenantsLoading(false);
          setSessionChecked(true);
        })
        .catch(() => setTenantsLoading(false));
    });
  }, [navigate]);

  function loadTenants() {
    setTenantsLoading(true);
    fetch("/api/admin/tenants", { credentials: "include" })
      .then((r) => r.json() as Promise<{ tenants: Tenant[] }>)
      .then((d) => setTenants(d.tenants ?? []))
      .finally(() => setTenantsLoading(false));
  }

  function loadUsers(tid: string) {
    setUsersLoading(true);
    const url = tid ? `/api/admin/users?tenantId=${encodeURIComponent(tid)}` : "/api/admin/users";
    fetch(url, { credentials: "include" })
      .then((r) => r.json() as Promise<{ users: User[] }>)
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setUsersLoading(false));
  }

  useEffect(() => {
    if (sessionChecked) loadUsers(tenantFilter);
  }, [sessionChecked, tenantFilter]);

  // --- Create ---
  function handleCreateNameChange(v: string) {
    setCreateName(v);
    const derived = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setCreateSlug(derived);
    scheduleSlugCheck(derived, setCreateSlugStatus, createSlugTimer);
  }

  function handleCreateSlugChange(v: string) {
    setCreateSlug(v);
    scheduleSlugCheck(v, setCreateSlugStatus, createSlugTimer);
  }

  function scheduleSlugCheck(
    slug: string,
    setStatus: (s: SlugStatus) => void,
    timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) {
    if (!slug) { setStatus("idle"); return; }
    setStatus("checking");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus(await checkTenantSlug(slug));
    }, 400);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug: createSlug, name: createName }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setCreateError(data.error ?? "Failed to create"); return; }
      setCreateName(""); setCreateSlug(""); setCreateSlugStatus("idle");
      loadTenants();
    } finally {
      setCreating(false);
    }
  }

  // --- Edit ---
  function startEdit(t: Tenant) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditSlug(t.slug);
    setEditSlugStatus("idle");
  }

  function handleEditSlugChange(v: string) {
    setEditSlug(v);
    scheduleSlugCheck(v, setEditSlugStatus, editSlugTimer);
  }

  async function handleSave(t: Tenant) {
    setSaving(true);
    try {
      await fetch(`/api/admin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName, slug: editSlug }),
      });
      setEditingId(null);
      loadTenants();
    } finally {
      setSaving(false);
    }
  }

  // --- Delete ---
  async function handleDelete(t: Tenant) {
    await fetch(`/api/admin/tenants/${t.id}`, { method: "DELETE", credentials: "include" });
    setDeletingId(null); setDeleteConfirmInput("");
    loadTenants();
  }

  async function handleRestore(t: Tenant) {
    await fetch(`/api/admin/tenants/${t.id}/restore`, { method: "POST", credentials: "include" });
    loadTenants();
  }

  if (!sessionChecked) return <SpinnerOverlay />;

  const activeTenants = tenants.filter((t) => !t.deleted_at);
  const deletedTenants = tenants.filter((t) => t.deleted_at);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Super Admin</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", marginTop: 2 }}>Manage tenants and users</p>
        </div>
        <button
          onClick={async () => { await authClient.signOut({ fetchOptions: { credentials: "include" } }); navigate("/admin/login"); }}
          style={ghostButtonStyle}
        >
          Sign out
        </button>
      </div>

      {/* ================================================================
          TENANTS SECTION
      ================================================================ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 20 }}>Tenants</h2>

        {/* Create form */}
        <form onSubmit={handleCreate} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: "0.95rem" }}>New Tenant</h3>
          <input
            placeholder="Name"
            value={createName}
            onChange={(e) => handleCreateNameChange(e.target.value)}
            required
            style={inputStyle}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              placeholder="Slug"
              value={createSlug}
              onChange={(e) => handleCreateSlugChange(e.target.value)}
              required
              pattern="[a-z0-9-]+"
              style={{
                ...inputStyle,
                borderColor: createSlugStatus === "available" ? "var(--color-accent)"
                  : createSlugStatus === "taken" || createSlugStatus === "invalid" ? "#e05c5c"
                    : undefined,
              }}
            />
            <SlugIndicator status={createSlugStatus} />
          </div>
          {createError && <p style={{ fontSize: "0.85rem", color: "#e05c5c" }}>{createError}</p>}
          <div>
            <button
              type="submit"
              disabled={creating || createSlugStatus === "taken" || createSlugStatus === "invalid"}
              style={accentButtonStyle}
            >
              {creating ? "Creating…" : "Create Tenant"}
            </button>
          </div>
        </form>

        {/* Active tenants */}
        {tenantsLoading ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activeTenants.map((t) => (
              <div key={t.id} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 8 }}>
                {editingId === t.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} placeholder="Name" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <input
                        value={editSlug}
                        onChange={(e) => handleEditSlugChange(e.target.value)}
                        style={{
                          ...inputStyle,
                          borderColor: editSlugStatus === "available" ? "var(--color-accent)"
                            : editSlugStatus === "taken" || editSlugStatus === "invalid" ? "#e05c5c"
                              : undefined,
                        }}
                        placeholder="Slug"
                      />
                      <SlugIndicator status={editSlugStatus} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleSave(t)}
                        disabled={saving || editSlugStatus === "taken" || editSlugStatus === "invalid"}
                        style={accentButtonStyle}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)} style={ghostButtonStyle}>Cancel</button>
                    </div>
                  </div>
                ) : deletingId === t.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <p style={{ fontSize: "0.9rem" }}>
                      Type <strong>{t.slug}</strong> to confirm deletion:
                    </p>
                    <input
                      value={deleteConfirmInput}
                      onChange={(e) => setDeleteConfirmInput(e.target.value)}
                      placeholder={t.slug}
                      style={inputStyle}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={deleteConfirmInput !== t.slug}
                        style={{ ...accentButtonStyle, background: deleteConfirmInput === t.slug ? "#e05c5c" : undefined, opacity: deleteConfirmInput === t.slug ? 1 : 0.4 }}
                      >
                        Delete
                      </button>
                      <button onClick={() => { setDeletingId(null); setDeleteConfirmInput(""); }} style={ghostButtonStyle}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginLeft: 8 }}>/{t.slug}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => navigate(`/${t.slug}/admin`)} style={ghostButtonStyle} title="Act as tenant">
                        Open →
                      </button>
                      <button onClick={() => startEdit(t)} style={ghostButtonStyle}>Edit</button>
                      <button
                        onClick={() => { setDeletingId(t.id); setDeleteConfirmInput(""); }}
                        style={{ ...ghostButtonStyle, color: "#e05c5c" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {activeTenants.length === 0 && (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>No tenants yet.</p>
            )}
          </div>
        )}

        {/* Soft-deleted tenants */}
        {deletedTenants.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", cursor: "pointer" }}>
              {deletedTenants.length} deleted tenant{deletedTenants.length !== 1 ? "s" : ""}
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {deletedTenants.map((t) => (
                <div key={t.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.55 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    <span style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginLeft: 8 }}>/{t.slug}</span>
                  </div>
                  <button onClick={() => handleRestore(t)} style={ghostButtonStyle}>Restore</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ================================================================
          USERS SECTION
      ================================================================ */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600 }}>Users</h2>
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              color: "var(--color-text)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            <option value="">All tenants</option>
            {activeTenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {usersLoading ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>Loading…</p>
        ) : users.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>No users found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-muted)" }}>Name</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-muted)" }}>Email</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-muted)" }}>Tenant</th>
                  <th style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-muted)" }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      {u.name}
                      {u.is_super_admin ? <span style={{ marginLeft: 6, fontSize: "0.7rem", padding: "2px 5px", borderRadius: 4, background: "var(--color-accent)", color: "#0f0f0f", fontWeight: 600 }}>SUPER</span> : null}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--color-text-muted)" }}>{u.email}</td>
                    <td style={{ padding: "8px 12px", color: "var(--color-text-muted)" }}>
                      {u.tenant_name ? (
                        <button
                          onClick={() => navigate(`/${tenants.find((t) => t.id === u.tenant_id)?.slug}/admin`)}
                          style={{ background: "none", border: "none", color: "var(--color-accent)", cursor: "pointer", padding: 0, fontSize: "inherit" }}
                        >
                          {u.tenant_name}
                        </button>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--color-text-muted)" }}>{u.role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
