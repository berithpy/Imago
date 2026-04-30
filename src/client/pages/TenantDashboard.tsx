import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { CreateGalleryForm } from "@/client/components/CreateGalleryForm";
import { GalleryList } from "@/client/components/GalleryList";
import { useTenant } from "@/client/lib/tenantContext";
import { useAuth } from "@/client/lib/authContext";
import { AppShell } from "@/client/components/shell/AppShell";
import { Button } from "@/client/components/Button";

export function TenantDashboard() {
  const navigate = useNavigate();
  const { apiBase, routeBase, tenantSlug } = useTenant();
  const { auth, loading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!auth) {
      navigate(`${routeBase}/login`);
      return;
    }
    // Authorized iff super-admin or member of this tenant.
    if (auth.superAdmin) return;
    const ok = auth.memberships.some((m) => m.tenantSlug === tenantSlug);
    if (!ok) navigate(`${routeBase}/login`);
  }, [auth, loading, tenantSlug, routeBase, navigate]);

  async function handleSoftDelete(id: string) {
    await fetch(`${apiBase}/admin/galleries/${id}`, { method: "DELETE", credentials: "include" });
  }

  async function handleRestore(id: string) {
    await fetch(`${apiBase}/admin/galleries/${id}/restore`, { method: "POST", credentials: "include" });
  }

  async function handlePermanentDelete(id: string) {
    await fetch(`${apiBase}/admin/galleries/${id}/permanent`, { method: "DELETE", credentials: "include" });
  }

  if (loading || !auth) return <SpinnerOverlay label="Loading..." />;

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-6 py-10">
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[1.1rem] font-semibold">Galleries</h2>
            <Button
              onClick={() => setShowCreate(!showCreate)}
              analyticsId="tenant_new_gallery"
              analyticsParams={{ action: showCreate ? "cancel" : "open" }}
              className="px-4 py-2 rounded-lg text-sm"
            >
              {showCreate ? "Cancel" : "+ New Gallery"}
            </Button>
          </div>

          {showCreate && (
            <CreateGalleryForm
              onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }}
              onCancel={() => setShowCreate(false)}
            />
          )}

          <GalleryList
            refreshKey={refreshKey}
            onSoftDelete={handleSoftDelete}
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
          />
        </section>
      </div>
    </AppShell>
  );
}
