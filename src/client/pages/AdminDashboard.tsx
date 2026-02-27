import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { CreateGalleryForm } from "@/client/components/CreateGalleryForm";
import { GalleryList } from "@/client/components/GalleryList";
import { accentButtonStyle, ghostButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

export function AdminDashboard() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    authClient.getSession({ fetchOptions: { credentials: "include" } }).then(({ data }) => {
      if (!data?.session) navigate("/admin/login");
      else setSessionChecked(true);
    });
  }, [navigate]);

  async function handleSignOut() {
    await authClient.signOut({ fetchOptions: { credentials: "include" } });
    navigate("/admin/login");
  }

  async function handleSoftDelete(id: string) {
    await fetch(`/api/admin/galleries/${id}`, { method: "DELETE", credentials: "include" });
  }

  async function handleRestore(id: string) {
    await fetch(`/api/admin/galleries/${id}/restore`, { method: "POST", credentials: "include" });
  }

  async function handlePermanentDelete(id: string) {
    await fetch(`/api/admin/galleries/${id}/permanent`, { method: "DELETE", credentials: "include" });
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
            onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {!sessionChecked ? (
          <SpinnerOverlay label="Loading…" />
        ) : (
          <GalleryList
            refreshKey={refreshKey}
            onSoftDelete={handleSoftDelete}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
          />
        )}
      </section>

    </div>
  );
}


