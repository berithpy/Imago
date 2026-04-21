import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { EmptyState } from "@/client/components/EmptyState";
import { GalleryManagementHeader } from "@/client/components/gallery-management/GalleryManagementHeader";
import { GalleryManagementSettingsPanel } from "@/client/components/gallery-management/GalleryManagementSettingsPanel";
import { GalleryManagementEmailWhitelistSection } from "@/client/components/gallery-management/GalleryManagementEmailWhitelistSection";
import { GalleryManagementPhotoGrid } from "@/client/components/gallery-management/GalleryManagementPhotoGrid";
import { GalleryManagementUploadControl } from "@/client/components/gallery-management/GalleryManagementUploadControl";
import type { Gallery, Photo } from "@/client/lib/galleryManagement";
import { useTenant } from "@/client/lib/tenantContext";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

export function GalleryManagementPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { apiBase, routeBase } = useTenant();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate(`${routeBase}/admin`);
      return;
    }

    authClient.getSession({ fetchOptions: { credentials: "include" } }).then(({ data }) => {
      if (!data?.session) {
        navigate(`${routeBase}/admin/login`);
        return;
      }
      void loadPhotos(id);
    });
  }, [id, navigate, routeBase]);

  async function loadPhotos(galleryId: string) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/photos`, {
        credentials: "include",
      });
      if (res.status === 401) {
        navigate(`${routeBase}/admin/login`);
        return;
      }
      if (res.status === 404) {
        navigate(`${routeBase}/admin`);
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data = (await res.json()) as { gallery: Gallery; photos: Photo[] };
      setGallery(data.gallery);
      setPhotos(data.photos ?? []);
    } catch (err) {
      console.error("Failed to load photos", err);
    } finally {
      setLoading(false);
    }
  }

  function updateGallery(updater: (current: Gallery) => Gallery) {
    setGallery((current) => (current ? updater(current) : current));
  }

  if (!id) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      <GalleryManagementHeader
        galleryId={id}
        gallery={gallery}
        hasPhotos={photos.length > 0}
        settingsOpen={showSettings}
        onToggleSettings={() => setShowSettings((value) => !value)}
        onGalleryUpdated={updateGallery}
        onPermanentDeleteSuccess={() => navigate("/admin")}
        uploadControl={
          <GalleryManagementUploadControl
            galleryId={id}
            onUploadComplete={() => void loadPhotos(id)}
          />
        }
      />

      {showSettings && gallery && (
        <>
          <GalleryManagementSettingsPanel
            galleryId={id}
            gallery={gallery}
            onClose={() => setShowSettings(false)}
            onGalleryUpdated={updateGallery}
          />
          <GalleryManagementEmailWhitelistSection galleryId={id} />
        </>
      )}

      {loading ? (
        <SpinnerOverlay label="Loading photos…" />
      ) : photos.length === 0 ? (
        <EmptyState
          message="No photos yet."
          action={
            <GalleryManagementUploadControl
              galleryId={id}
              onUploadComplete={() => void loadPhotos(id)}
              buttonLabel="Upload your first photo"
            />
          }
        />
      ) : (
        <GalleryManagementPhotoGrid
          galleryId={id}
          gallery={gallery}
          photos={photos}
          onPhotosChange={(updater) => setPhotos((current) => updater(current))}
          onGalleryUpdated={updateGallery}
        />
      )}
    </div>
  );
}
