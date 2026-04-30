import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { CreateGalleryForm } from "@/client/components/CreateGalleryForm";
import { GalleryList } from "@/client/components/GalleryList";
import { useTenant } from "@/client/lib/tenantContext";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

export function AdminDashboard() {
  const navigate = useNavigate();
  const { apiBase, routeBase } = useTenant();
  const [showCreate, setShowCreate] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    authClient.getSession({ fetchOptions: { credentials: "include" } }).then(({ data }) => {
      if (!data?.session) navigate(`${routeBase}/admin/login`);
      else setSessionChecked(true);
    });
  }, [navigate, routeBase]);

  async function handleSignOut() {
    await authClient.signOut({ fetchOptions: { credentials: "include" } });
    navigate(`${routeBase}/admin/login`);
  }

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
    <div className="max-w-[900px] mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <a href={routeBase || "/"} className="text-sm text-neutral-500">Site</a>
          <h1 className="text-[1.75rem] font-bold mt-1">Admin</h1>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer"
        >
          Sign out
        </button>
      </div>

      {/* Galleries */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[1.1rem] font-semibold">Galleries</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm cursor-pointer"
          >
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
          <SpinnerOverlay label="Loading..." />
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
