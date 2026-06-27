import { useState } from "react";
import { CreateGalleryForm } from "@/client/components/CreateGalleryForm";
import { GalleryList } from "@/client/components/GalleryList";
import { useTenant } from "@/client/lib/tenantContext";
import { AppShell } from "@/client/components/shell/AppShell";
import { Button } from "@/client/components/Button";
import { AuthCheckBoundary, useAuthCheck } from "@/client/lib/authGate";

export function TenantDashboard() {
  const { apiBase, routeBase, tenantSlug } = useTenant();
  const authCheck = useAuthCheck({
    role: "tenant-member",
    tenantSlug,
    loginPath: `${routeBase}/login`,
    returnTo: `${routeBase}/manage`,
    unauthorizedTo: routeBase,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleSoftDelete(id: string) {
    await fetch(`${apiBase}/admin/galleries/${id}`, { method: "DELETE", credentials: "include" });
  }

  async function handleRestore(id: string) {
    await fetch(`${apiBase}/admin/galleries/${id}/restore`, { method: "POST", credentials: "include" });
  }

  async function handlePermanentDelete(id: string) {
    await fetch(`${apiBase}/admin/galleries/${id}/permanent`, { method: "DELETE", credentials: "include" });
  }

  return (
    <AuthCheckBoundary decision={authCheck}>
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
    </AuthCheckBoundary>
  );
}
