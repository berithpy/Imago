import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { EmptyState } from "@/client/components/EmptyState";
import { GalleryManagementHeader } from "@/client/components/gallery-management/GalleryManagementHeader";
import { GalleryManagementSettingsPanel } from "@/client/components/gallery-management/GalleryManagementSettingsPanel";
import { GalleryManagementEmailWhitelistSection } from "@/client/components/gallery-management/GalleryManagementEmailWhitelistSection";
import { GalleryManagementPhotoGrid } from "@/client/components/gallery-management/GalleryManagementPhotoGrid";
import { GalleryManagementUploadControl } from "@/client/components/gallery-management/GalleryManagementUploadControl";
import type { Gallery, Photo } from "@/client/lib/galleryManagement";
import { useTenant } from "@/client/lib/tenantContext";
import { useAuth } from "@/client/lib/authContext";
import { AppShell } from "@/client/components/shell/AppShell";

export function GalleryManagementPage() {
  const { gallerySlug } = useParams<{ gallerySlug: string }>();
  const navigate = useNavigate();
  const { apiBase, routeBase, tenantSlug } = useTenant();
  const { auth, loading: authLoading } = useAuth();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!gallerySlug) {
      navigate(`${routeBase}/manage`);
      return;
    }
    if (authLoading) return;
    if (!auth) {
      navigate(`${routeBase}/login`);
      return;
    }
    if (!auth.superAdmin && !auth.memberships.some((m) => m.tenantSlug === tenantSlug)) {
      navigate(`${routeBase}/login`);
      return;
    }
    void loadGallery(gallerySlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallerySlug, auth, authLoading, navigate, routeBase, tenantSlug]);

  async function loadGallery(slug: string) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/by-slug/${slug}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        navigate(`${routeBase}/login`);
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        setGallery(null);
        setPhotos([]);
        return;
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const data = (await res.json()) as { gallery: Gallery; photos: Photo[] };
      setGallery(data.gallery);
      setPhotos(data.photos ?? []);
      setNotFound(false);
    } catch (err) {
      console.error("Failed to load gallery", err);
    } finally {
      setLoading(false);
    }
  }

  function reloadPhotos() {
    if (!gallery) return;
    void loadGallery(gallery.slug);
  }

  function updateGallery(updater: (current: Gallery) => Gallery) {
    setGallery((current) => (current ? updater(current) : current));
  }

  if (!gallerySlug) return null;

  if (notFound) {
    return (
      <AppShell gallerySlug={gallerySlug}>
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <EmptyState
            message="Gallery not found."
            action={
              <button
                onClick={() => navigate(`${routeBase}/manage`)}
                className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer"
              >
                Back to galleries
              </button>
            }
          />
        </div>
      </AppShell>
    );
  }

  const galleryId = gallery?.id;

  return (
    <AppShell gallerySlug={gallerySlug}>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <GalleryManagementHeader
          galleryId={galleryId ?? ""}
          gallery={gallery}
          hasPhotos={photos.length > 0}
          settingsOpen={showSettings}
          onToggleSettings={() => setShowSettings((value) => !value)}
          onGalleryUpdated={updateGallery}
          onPermanentDeleteSuccess={() => navigate(`${routeBase}/manage`)}
          uploadControl={
            galleryId ? (
              <GalleryManagementUploadControl
                galleryId={galleryId}
                onUploadComplete={reloadPhotos}
              />
            ) : null
          }
        />

        {showSettings && gallery && (
          <>
            <GalleryManagementSettingsPanel
              galleryId={gallery.id}
              gallery={gallery}
              onClose={() => setShowSettings(false)}
              onGalleryUpdated={updateGallery}
            />
            <GalleryManagementEmailWhitelistSection galleryId={gallery.id} />
          </>
        )}

        {loading ? (
          <SpinnerOverlay label="Loading photos..." />
        ) : photos.length === 0 ? (
          <EmptyState
            message="No photos yet."
            action={
              galleryId ? (
                <GalleryManagementUploadControl
                  galleryId={galleryId}
                  onUploadComplete={reloadPhotos}
                  buttonLabel="Upload your first photo"
                />
              ) : null
            }
          />
        ) : (
          gallery && (
            <GalleryManagementPhotoGrid
              galleryId={gallery.id}
              gallery={gallery}
              photos={photos}
              onPhotosChange={(updater) => setPhotos((current) => updater(current))}
              onGalleryUpdated={updateGallery}
            />
          )
        )}
      </div>
    </AppShell>
  );
}
