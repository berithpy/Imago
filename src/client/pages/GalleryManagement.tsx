import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/client/components/EmptyState";
import { Header } from "@/client/components/gallery-management/Header";
import { InfoPanel } from "@/client/components/gallery-management/InfoPanel";
import { SettingsPanel } from "@/client/components/gallery-management/SettingsPanel";
import { EmailWhitelistSection } from "@/client/components/gallery-management/EmailWhitelistSection";
import { PhotoGrid } from "@/client/components/gallery-management/PhotoGrid";
import { ShareAccessPanel } from "@/client/components/gallery-management/ShareAccessPanel";
import { UploadControl } from "@/client/components/gallery-management/UploadControl";
import type { Gallery, NewGalleryShareAccessState, Photo } from "@/client/lib/galleryManagement";
import { useTenant } from "@/client/lib/tenantContext";
import { AppShell } from "@/client/components/shell/AppShell";
import {
  AuthCheckBoundary,
  AuthCheckPlaceholder,
  useAuthCheck,
} from "@/client/lib/authGate";

export function GalleryManagement() {
  const { gallerySlug } = useParams<{ gallerySlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { apiBase, routeBase, tenantSlug } = useTenant();
  const authCheck = useAuthCheck({
    role: "tenant-member",
    tenantSlug,
    loginPath: `${routeBase}/login`,
    returnTo: gallerySlug ? `${routeBase}/${gallerySlug}/edit` : `${routeBase}/manage`,
    unauthorizedTo: routeBase,
  });
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
    if (authCheck.outcome !== "allowed") {
      return;
    }
    void loadGallery(gallerySlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallerySlug, authCheck.outcome, navigate, routeBase]);

  async function loadGallery(slug: string) {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/by-slug/${slug}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        navigate(routeBase, { replace: true });
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
      <AuthCheckBoundary decision={authCheck}>
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
      </AuthCheckBoundary>
    );
  }

  const galleryId = gallery?.id;
  const totalBytes = photos.reduce((sum, photo) => sum + (photo.size ?? 0), 0);
  const shareAccess = (location.state as { shareAccess?: NewGalleryShareAccessState } | null)?.shareAccess;
  const showShareAccess = !!gallery && shareAccess?.gallerySlug === gallery.slug;

  return (
    <AuthCheckBoundary decision={authCheck}>
      <AppShell gallerySlug={gallerySlug}>
        <div className="max-w-[1100px] mx-auto px-6 py-10">
          <Header
            galleryId={galleryId ?? ""}
            gallery={gallery}
            hasPhotos={photos.length > 0}
            settingsOpen={showSettings}
            onToggleSettings={() => setShowSettings((value) => !value)}
            onUploadComplete={galleryId ? reloadPhotos : undefined}
          />

          {showShareAccess && shareAccess ? (
            <ShareAccessPanel
              {...shareAccess}
              routeBase={routeBase}
              onConsumed={() => navigate(location.pathname, { replace: true, state: null })}
            />
          ) : null}

          {gallery && (
            <div className="mb-8">
              <InfoPanel photoCount={photos.length} totalBytes={totalBytes} />
            </div>
          )}

          {showSettings && gallery && (
            <>
              <SettingsPanel
                galleryId={gallery.id}
                gallery={gallery}
                onClose={() => setShowSettings(false)}
                onGalleryUpdated={updateGallery}
                onPermanentDeleteSuccess={() => navigate(`${routeBase}/manage`)}
              />
              <EmailWhitelistSection galleryId={gallery.id} />
            </>
          )}

          {loading ? (
            <AuthCheckPlaceholder label="Loading photos..." />
          ) : photos.length === 0 ? (
            <EmptyState
              message="No photos yet."
              action={
                galleryId ? (
                  <UploadControl
                    galleryId={galleryId}
                    onUploadComplete={reloadPhotos}
                    buttonLabel="Upload your first photo"
                  />
                ) : null
              }
            />
          ) : (
            gallery && (
              <PhotoGrid
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
    </AuthCheckBoundary>
  );
}
