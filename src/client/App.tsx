import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { GalleryIndex } from "@/client/pages/GalleryIndex";
import { GalleryLogin } from "@/client/pages/GalleryLogin";
import { GalleryView } from "@/client/pages/GalleryView";
import { AdminLogin } from "@/client/pages/AdminLogin";
import { AdminDashboard } from "@/client/pages/AdminDashboard";
import { AdminSetup } from "@/client/pages/AdminSetup";
import { GalleryManagementPage } from "@/client/pages/GalleryManagementPage";
import { SuperAdminDashboard } from "@/client/pages/SuperAdminDashboard";
import { Landing } from "@/client/pages/Landing";
import { TenantProvider } from "@/client/lib/tenantContext";

function LegacyGalleryRedirect() {
  const { gallerySlug } = useParams<{ gallerySlug: string }>();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-xl font-bold">Link outdated</h2>
      <p className="text-neutral-500 text-center max-w-[380px]">
        The URL <code>/gallery/{gallerySlug}</code> is no longer valid.
        Please reach out to get a new link.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<Landing />} />

      {/* Global super-admin routes (static — matched before /:tenantSlug) */}
      <Route path="/admin/setup" element={<AdminSetup />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<SuperAdminDashboard />} />

      {/* Legacy /gallery/:slug URLs — show a helpful error */}
      <Route path="/gallery/:gallerySlug" element={<LegacyGalleryRedirect />} />

      {/* Tenant-scoped routes */}
      <Route path="/:tenantSlug" element={<TenantProvider />}>
        <Route index element={<GalleryIndex />} />
        <Route path=":gallerySlug/login" element={<GalleryLogin />} />
        <Route path=":gallerySlug/*" element={<GalleryView />} />
        <Route path="admin/setup" element={<AdminSetup />} />
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/galleries/:id" element={<GalleryManagementPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
