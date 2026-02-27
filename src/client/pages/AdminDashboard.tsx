import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { EmptyState } from "@/client/components/EmptyState";
import { CreateGalleryForm } from "@/client/components/CreateGalleryForm";
import { cardStyle, accentButtonStyle, ghostButtonStyle, dangerButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

type Gallery = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: number;
  banner_photo_id: string | null;
  event_date: number | null;
  expires_at: number | null;
  deleted_at: number | null;
  created_at: number;
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    // Check session
    authClient.getSession({ fetchOptions: { credentials: "include" } }).then(({ data }) => {
      if (!data?.session) navigate("/admin/login");
      else loadGalleries();
    });
  }, [navigate]);

  async function loadGalleries() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/galleries", { credentials: "include" });
      if (res.status === 401) { navigate("/admin/login"); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { galleries: Gallery[] };
      setGalleries(data.galleries ?? []);
    } catch (err) {
      console.error("Failed to load galleries", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut({ fetchOptions: { credentials: "include" } });
    navigate("/admin/login");
  }

  async function handleSoftDelete(id: string, name: string) {
    if (!confirm(`Hide gallery "${name}" from viewers? You can restore it later.`)) return;
    setActionInProgress(id);
    await fetch(`/api/admin/galleries/${id}`, { method: "DELETE", credentials: "include" });
    setActionInProgress(null);
    loadGalleries();
  }

  async function handleRestore(id: string) {
    setActionInProgress(id);
    await fetch(`/api/admin/galleries/${id}/restore`, { method: "POST", credentials: "include" });
    setActionInProgress(null);
    loadGalleries();
  }

  async function handlePermanentDelete(id: string, name: string) {
    if (!confirm(`Permanently delete "${name}" and ALL its photos? This cannot be undone.`)) return;
    setActionInProgress(id);
    await fetch(`/api/admin/galleries/${id}/permanent`, { method: "DELETE", credentials: "include" });
    setActionInProgress(null);
    loadGalleries();
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div>
          <a href="/" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>← Site</a>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 4 }}>Admin</h1>
        </div>
        <button onClick={handleSignOut} style={ghostButtonStyle}>Sign out</button>
      </div>

      {/* Galleries */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>Galleries</h2>
          <button onClick={() => setShowCreate(!showCreate)} style={accentButtonStyle}>
            {showCreate ? "Cancel" : "+ New Gallery"}
          </button>
        </div>

        {/* Create gallery form */}
        {showCreate && (
          <CreateGalleryForm
            onCreated={() => { setShowCreate(false); loadGalleries(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {loading ? (
          <SpinnerOverlay label="Loading galleries…" />
        ) : galleries.length === 0 ? (
          <EmptyState message="No galleries yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {galleries.map((g) => (
              <div
                key={g.id}
                style={{
                  ...cardStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: g.deleted_at ? 0.55 : 1,
                }}
              >
                <Link
                  to={`/admin/galleries/${g.id}`}
                  style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    {g.is_public ? (
                      <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 4, background: "var(--color-accent)", color: "#0f0f0f", fontWeight: 600 }}>PUBLIC</span>
                    ) : null}
                    {g.deleted_at ? (
                      <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 4, background: "var(--color-border)", color: "var(--color-text-muted)", fontWeight: 600 }}>HIDDEN</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>/{g.slug}</div>
                  {g.event_date ? (
                    <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                      📅 {new Date(g.event_date * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  ) : null}
                  {g.expires_at ? (
                    <div style={{ fontSize: "0.8rem", color: g.expires_at * 1000 < Date.now() ? "var(--color-error)" : "var(--color-text-muted)" }}>
                      ⏳ Expires {new Date(g.expires_at * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  ) : null}
                </Link>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {g.deleted_at ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleRestore(g.id); }} disabled={actionInProgress === g.id} style={{ ...ghostButtonStyle, fontSize: "0.85rem" }}>Restore</button>
                      <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(g.id, g.name); }} disabled={actionInProgress === g.id} style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}>Delete forever</button>
                    </>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); handleSoftDelete(g.id, g.name); }} disabled={actionInProgress === g.id} style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}>Hide</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}


