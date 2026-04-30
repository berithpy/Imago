import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { GalleryIndex } from "@/client/pages/GalleryIndex";
import { GalleryLogin } from "@/client/pages/GalleryLogin";
import { GalleryView } from "@/client/pages/GalleryView";
import { TenantLogin } from "@/client/pages/TenantLogin";
import { TenantDashboard } from "@/client/pages/TenantDashboard";
import { AdminSetup } from "@/client/pages/AdminSetup";
import { GalleryManagementPage } from "@/client/pages/GalleryManagementPage";
import { OperatorDashboard } from "@/client/pages/OperatorDashboard";
import { UniversalLogin } from "@/client/pages/UniversalLogin";
import { LoginResolve } from "@/client/pages/LoginResolve";
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

      {/* Universal login (admin + super-admin entry point) */}
      <Route path="/login" element={<UniversalLogin />} />
      <Route path="/login/resolve" element={<LoginResolve />} />

      {/* Operator (super-admin) routes */}
      <Route path="/operator/setup" element={<AdminSetup />} />
      <Route path="/operator" element={<OperatorDashboard />} />

      {/* Legacy /gallery/:slug URLs — show a helpful error */}
      <Route path="/gallery/:gallerySlug" element={<LegacyGalleryRedirect />} />

      {/* Tenant-scoped routes */}
      <Route path="/:tenantSlug" element={<TenantProvider />}>
        <Route index element={<GalleryIndex />} />
        {/* Admin routes — literal segments must come before :gallerySlug catch-alls */}
        <Route path="manage" element={<TenantDashboard />} />
        <Route path="login" element={<TenantLogin />} />
        <Route path="setup" element={<AdminSetup />} />
        {/* Gallery editor — slug-based, mirrors viewer URL */}
        <Route path=":gallerySlug/edit" element={<GalleryManagementPage />} />
        {/* Viewer routes */}
        <Route path=":gallerySlug/login" element={<GalleryLogin />} />
        <Route path=":gallerySlug/*" element={<GalleryView />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
