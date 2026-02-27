import { Routes, Route, Navigate } from "react-router-dom";
import { GalleryIndex } from "@/client/pages/GalleryIndex";
import { GalleryLogin } from "@/client/pages/GalleryLogin";
import { GalleryView } from "@/client/pages/GalleryView";
import { AdminLogin } from "@/client/pages/AdminLogin";
import { AdminDashboard } from "@/client/pages/AdminDashboard";
import { AdminSetup } from "@/client/pages/AdminSetup";
import { AdminGallery } from "@/client/pages/AdminGallery";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<GalleryIndex />} />
      <Route path="/gallery/:slug/login" element={<GalleryLogin />} />
      <Route path="/gallery/:slug" element={<GalleryView />} />

      {/* Admin */}
      <Route path="/admin/setup" element={<AdminSetup />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/galleries/:id" element={<AdminGallery />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
