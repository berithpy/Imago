import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/client/components/Button";
import { CreateTenantForm, SlugIndicator, checkTenantSlug } from "@/client/components/CreateTenantForm";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { AppShell } from "@/client/components/shell/AppShell";
import { useAuth } from "@/client/lib/authContext";

const cardClass = "bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-5";
const inputClass =
  "w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";
const accentBtnClass =
  "inline-block px-5 py-2.5 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const ghostBtnClass =
  "px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer";

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

export function OperatorDashboard() {
  const navigate = useNavigate();
  const { auth, loading: authLoading } = useAuth();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [showCreateTenant, setShowCreateTenant] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSlugStatus, setEditSlugStatus] = useState<SlugStatus>("idle");
  const editSlugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!auth) { navigate("/login", { replace: true }); return; }
    if (!auth.superAdmin) { navigate("/login?error=not-authorized", { replace: true }); return; }
    fetch("/api/operator/tenants", { credentials: "include" })
      .then((r) => r.json() as Promise<{ tenants: Tenant[] }>)
      .then((d) => {
        setTenants(d.tenants ?? []);
        setTenantsLoading(false);
        setSessionChecked(true);
      })
      .catch(() => setTenantsLoading(false));
  }, [auth, authLoading, navigate]);

  function loadTenants() {
    setTenantsLoading(true);
    fetch("/api/operator/tenants", { credentials: "include" })
      .then((r) => r.json() as Promise<{ tenants: Tenant[] }>)
      .then((d) => setTenants(d.tenants ?? []))
      .finally(() => setTenantsLoading(false));
  }

  function loadUsers(tid: string) {
    setUsersLoading(true);
    const url = tid ? `/api/tenant/users?tenantId=${encodeURIComponent(tid)}` : "/api/tenant/users";
    fetch(url, { credentials: "include" })
      .then((r) => r.json() as Promise<{ users: User[] }>)
      .then((d) => setUsers(d.users ?? []))
      .finally(() => setUsersLoading(false));
  }

  useEffect(() => {
    if (sessionChecked) loadUsers(tenantFilter);
  }, [sessionChecked, tenantFilter]);

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
      await fetch(`/api/operator/tenants/${t.id}`, {
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

  async function handleDelete(t: Tenant) {
    await fetch(`/api/operator/tenants/${t.id}`, { method: "DELETE", credentials: "include" });
    setDeletingId(null); setDeleteConfirmInput("");
    loadTenants();
  }

  async function handleRestore(t: Tenant) {
    await fetch(`/api/operator/tenants/${t.id}/restore`, { method: "POST", credentials: "include" });
    loadTenants();
  }

  if (!sessionChecked) return <SpinnerOverlay />;

  const activeTenants = tenants.filter((t) => !t.deleted_at);
  const deletedTenants = tenants.filter((t) => t.deleted_at);

  function slugBorder(status: SlugStatus): string {
    if (status === "available") return "border-amber-400";
    if (status === "taken" || status === "invalid") return "border-red-400";
    return "border-neutral-800";
  }

  return (
    <AppShell>
      <div className="max-w-[960px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[1.75rem] font-bold">Operator</h1>
          <p className="text-neutral-500 text-sm mt-0.5">Manage tenants and users</p>
        </div>

        {/* TENANTS */}
        <section className="mb-14">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[1.15rem] font-semibold">Tenants</h2>
            <Button
              onClick={() => setShowCreateTenant((open) => !open)}
              analyticsId="operator_new_tenant"
              analyticsParams={{ action: showCreateTenant ? "cancel" : "open" }}
              className="px-4 py-2 rounded-lg text-sm"
            >
              {showCreateTenant ? "Cancel" : "+ New Tenant"}
            </Button>
          </div>

          {showCreateTenant && (
            <CreateTenantForm
              onCreated={() => {
                setShowCreateTenant(false);
                loadTenants();
              }}
              onCancel={() => setShowCreateTenant(false)}
            />
          )}

          {/* Active tenants */}
          {tenantsLoading ? (
            <p className="text-neutral-500 text-sm">Loading...</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activeTenants.map((t) => (
                <div key={t.id} className={`${cardClass} flex flex-col gap-2`}>
                  {editingId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} placeholder="Name" />
                      <div className="flex flex-col gap-1">
                        <input
                          value={editSlug}
                          onChange={(e) => handleEditSlugChange(e.target.value)}
                          className={`w-full px-4 py-3 bg-neutral-950 border ${slugBorder(editSlugStatus)} rounded-lg text-neutral-100 text-sm outline-none`}
                          placeholder="Slug"
                        />
                        <SlugIndicator status={editSlugStatus} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(t)}
                          disabled={saving || editSlugStatus === "taken" || editSlugStatus === "invalid"}
                          className={accentBtnClass}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => setEditingId(null)} className={ghostBtnClass}>Cancel</button>
                      </div>
                    </div>
                  ) : deletingId === t.id ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm">
                        Type <strong>{t.slug}</strong> to confirm deletion:
                      </p>
                      <input
                        value={deleteConfirmInput}
                        onChange={(e) => setDeleteConfirmInput(e.target.value)}
                        placeholder={t.slug}
                        className={inputClass}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={deleteConfirmInput !== t.slug}
                          className={`inline-block px-4 py-2 border-0 rounded-lg font-semibold text-sm cursor-pointer ${deleteConfirmInput === t.slug ? "bg-red-400 text-neutral-950" : "bg-amber-400 text-neutral-950 opacity-40"
                            }`}
                        >
                          Delete
                        </button>
                        <button onClick={() => { setDeletingId(null); setDeleteConfirmInput(""); }} className={ghostBtnClass}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-neutral-500 text-sm ml-2">/{t.slug}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => navigate(`/${t.slug}/manage`)} className={ghostBtnClass} title="Act as tenant">
                          Open
                        </button>
                        <button onClick={() => startEdit(t)} className={ghostBtnClass}>Edit</button>
                        <button
                          onClick={() => { setDeletingId(t.id); setDeleteConfirmInput(""); }}
                          className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-red-400 text-sm cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {activeTenants.length === 0 && (
                <p className="text-neutral-500 text-sm">No tenants yet.</p>
              )}
            </div>
          )}

          {/* Soft-deleted tenants */}
          {deletedTenants.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-neutral-500 cursor-pointer">
                {deletedTenants.length} deleted tenant{deletedTenants.length !== 1 ? "s" : ""}
              </summary>
              <div className="flex flex-col gap-2 mt-2">
                {deletedTenants.map((t) => (
                  <div key={t.id} className={`${cardClass} flex justify-between items-center opacity-55`}>
                    <div>
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-neutral-500 text-sm ml-2">/{t.slug}</span>
                    </div>
                    <button onClick={() => handleRestore(t)} className={ghostBtnClass}>Restore</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* USERS */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[1.15rem] font-semibold">Users</h2>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-100 text-sm cursor-pointer"
            >
              <option value="">All tenants</option>
              {activeTenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {usersLoading ? (
            <p className="text-neutral-500 text-sm">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-neutral-500 text-sm">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.875rem]">
                <thead>
                  <tr className="border-b border-neutral-800 text-left">
                    <th className="px-3 py-3 font-semibold text-neutral-500">Name</th>
                    <th className="px-3 py-3 font-semibold text-neutral-500">Email</th>
                    <th className="px-3 py-3 font-semibold text-neutral-500">Tenant</th>
                    <th className="px-3 py-3 font-semibold text-neutral-500">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-neutral-800">
                      <td className="px-3 py-3">
                        {u.name}
                        {u.is_super_admin ? (
                          <span className="ml-1.5 text-[0.7rem] px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 font-semibold">SUPER</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-neutral-500">{u.email}</td>
                      <td className="px-3 py-3 text-neutral-500">
                        {u.tenant_name ? (
                          <button
                            onClick={() => navigate(`/${tenants.find((t) => t.id === u.tenant_id)?.slug}/manage`)}
                            className="bg-transparent border-0 text-amber-400 cursor-pointer p-0 text-inherit"
                          >
                            {u.tenant_name}
                          </button>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-3 text-neutral-500">{u.role ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
