import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Masonry } from "masonic";
import { Spinner, SpinnerOverlay } from "@/client/components/Spinner";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { EmptyState } from "@/client/components/EmptyState";
import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { Lightbox } from "@/client/components/Lightbox";
import { exportGallery } from "@/client/lib/exportGallery";
import { useTenant } from "@/client/lib/tenantContext";
import { shareUrl } from "@/client/lib/share";
import {
  AuthCheckBoundary,
  AuthCheckPlaceholder,
  type AuthCheckDecision,
} from "@/client/lib/authGate";
import { buildAppReturnTo, withReturnTo } from "@/client/lib/authRedirect";
import { buildGalleryViewMetadata } from "@/client/lib/pageMetadata";
import { usePageMetadata } from "@/client/lib/usePageMetadata";
import { AppShell } from "@/client/components/shell/AppShell";
import { Button } from "@/client/components/Button";
import { track, setUserProperties } from "@/client/lib/analytics";
import {
  getActivePhotoIndex,
  getAdjacentPreloadPhotos,
  getNavigationTargetIndex,
} from "@/client/lib/lightboxNavigation";

type Photo = {
  id: string;
  r2_key: string;
  original_name: string;
  size: number;
  uploaded_at: number;
  sort_order: number;
};

type FetchPhotosResult = {
  needsAuth: boolean;
  photos: Photo[];
  nextCursor: string | null;
  total: number;
  authMethod?: string;
};

function PhotoCard({ data: photo, width, index }: { data: Photo; width: number; index: number }) {
  const ctx = (PhotoCard as any)._ctx as { onClick: (p: Photo) => void; total: number; showInfo: boolean };
  return (
    <PhotoThumbnail
      r2Key={photo.r2_key}
      alt={photo.original_name}
      fit="full-width"
      style={{ width, display: "block" }}
      onClick={() => ctx.onClick(photo)}
      index={ctx.showInfo ? index + 1 : undefined}
      total={ctx.showInfo ? ctx.total : undefined}
      filename={ctx.showInfo ? photo.original_name : undefined}
    />
  );
}

function MasonryGrid({
  photos,
  total,
  onPhotoClick,
  showInfo,
  scrollToIndex,
}: {
  photos: Photo[];
  total: number;
  onPhotoClick: (p: Photo) => void;
  showInfo: boolean;
  scrollToIndex?: number;
}) {
  (PhotoCard as any)._ctx = { onClick: onPhotoClick, total, showInfo };
  return (
    <Masonry
      items={photos}
      render={PhotoCard}
      columnWidth={280}
      columnGutter={12}
      itemKey={(data: Photo) => `${data.id}-${showInfo}`}
      itemHeightEstimate={320}
      scrollToIndex={scrollToIndex == null ? undefined : { index: scrollToIndex, align: "center" }}
    />
  );
}

export function GalleryView() {
  const { gallerySlug } = useParams<{ gallerySlug: string }>();
  const location = useLocation();
  const { apiBase, routeBase, tenantName } = useTenant();

  const getPhotoIdFromPath = useCallback((pathname: string): string | undefined => {
    if (!gallerySlug) return undefined;
    const prefix = `${routeBase}/${gallerySlug}/photo/`;
    if (!pathname.startsWith(prefix)) return undefined;
    const rawPhotoId = pathname.slice(prefix.length).split("/")[0];
    return rawPhotoId ? decodeURIComponent(rawPhotoId) : undefined;
  }, [gallerySlug, routeBase]);

  const [routePhotoId, setRoutePhotoId] = useState<string | undefined>(() => getPhotoIdFromPath(window.location.pathname));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [galleryName, setGalleryName] = useState("");
  const [eventDate, setEventDate] = useState<number | null>(null);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const [authCheck, setAuthCheck] = useState<AuthCheckDecision>({ outcome: "unknown" });

  const loadingMoreRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const analyticsFiredKeyRef = useRef<string | null>(null);
  const preloadedPhotoIdsRef = useRef<Set<string>>(new Set());
  const getPhotoIdFromPathRef = useRef(getPhotoIdFromPath);
  const initialRoutePhotoIdRef = useRef(routePhotoId);
  const initialDeepLinkScrollCompleteRef = useRef(!routePhotoId);
  const [pendingScrollToIndex, setPendingScrollToIndex] = useState<number | undefined>(undefined);
  getPhotoIdFromPathRef.current = getPhotoIdFromPath;

  useEffect(() => {
    setRoutePhotoId(getPhotoIdFromPath(location.pathname));
  }, [location.pathname, getPhotoIdFromPath]);

  useEffect(() => {
    const onPopState = () => {
      setRoutePhotoId(getPhotoIdFromPathRef.current(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const fetchPhotos = useCallback(
    async (cursor?: string): Promise<FetchPhotosResult> => {
      const url = `${apiBase}/galleries/${gallerySlug}/photos${cursor ? `?cursor=${cursor}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        return { needsAuth: true, photos: [], nextCursor: null, total: 0 };
      }
      const data = await res.json() as { photos: Photo[]; nextCursor: string | null; total: number; authMethod?: string };
      return { needsAuth: false, photos: data.photos ?? [], nextCursor: data.nextCursor ?? null, total: data.total ?? 0, authMethod: data.authMethod };
    },
    [gallerySlug, apiBase]
  );

  const fetchSinglePhoto = useCallback(
    async (photoId: string): Promise<Photo | null> => {
      const res = await fetch(`${apiBase}/galleries/${gallerySlug}/photos/${photoId}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json() as { photo?: Photo };
      return data.photo ?? null;
    },
    [gallerySlug, apiBase]
  );

  useEffect(() => {
    let cancelled = false;
    let isPublicGallery = false;

    async function init() {
      setLoading(true);
      setAuthCheck({ outcome: "unknown" });
      try {
        const metaRes = await fetch(`${apiBase}/galleries/${gallerySlug}`);
        if (cancelled) return;
        if (metaRes.status === 410) { setExpired(true); setAuthCheck({ outcome: "allowed" }); setLoading(false); return; }
        if (metaRes.status === 404) { setError("Gallery not found."); setAuthCheck({ outcome: "allowed" }); setLoading(false); return; }
        if (!metaRes.ok) { setError("Failed to load gallery."); setAuthCheck({ outcome: "allowed" }); setLoading(false); return; }
        const d = await metaRes.json() as { gallery?: { name: string; is_public: number; banner_r2_key: string | null; event_date: number | null } };
        if (cancelled) return;
        isPublicGallery = !!d.gallery?.is_public;
        setGalleryName(d.gallery?.name ?? "");
        setIsPublic(isPublicGallery);
        setBannerKey(d.gallery?.banner_r2_key ?? null);
        setEventDate(d.gallery?.event_date ?? null);
      } catch {
        if (!cancelled) {
          setError("Failed to load gallery.");
          setAuthCheck({ outcome: "allowed" });
          setLoading(false);
        }
        return;
      }

      try {
        const data = await fetchPhotos();
        if (cancelled) return;
        if (data.needsAuth) {
          if (!isPublicGallery) {
            setAuthCheck({
              outcome: "redirect",
              to: withReturnTo(
                `${routeBase}/${gallerySlug}/login`,
                buildAppReturnTo(location.pathname, location.search, location.hash)
              ),
            });
          }
          return;
        }
        setPhotos(data.photos);
        setNextCursor(data.nextCursor);
        setTotal(data.total);

        const authMethod = data.authMethod ?? "unknown";
        const firedKey = `${gallerySlug}:${authMethod}`;
        if (analyticsFiredKeyRef.current !== firedKey) {
          analyticsFiredKeyRef.current = firedKey;
          setUserProperties({ viewer_auth_method: authMethod });
          track("gallery_view", { gallery_slug: gallerySlug, auth_method: authMethod });
        }
        setAuthCheck({ outcome: "allowed" });
      } catch {
        setError("Failed to load photos");
        setAuthCheck({ outcome: "allowed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [gallerySlug, fetchPhotos, apiBase, routeBase, retryCount, location.pathname, location.search, location.hash]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const data = await fetchPhotos(nextCursor);
      if (data.needsAuth) {
        if (!isPublic) {
          setAuthCheck({
            outcome: "redirect",
            to: withReturnTo(
              `${routeBase}/${gallerySlug}/login`,
              buildAppReturnTo(location.pathname, location.search, location.hash)
            ),
          });
        }
        return;
      }
      setPhotos((prev) => [...prev, ...data.photos]);
      setNextCursor(data.nextCursor);
      setTotal(data.total);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, gallerySlug, isPublic, fetchPhotos, routeBase, location.pathname, location.search, location.hash]);

  useEffect(() => {
    let cancelled = false;
    async function syncLightboxWithRoute() {
      if (!routePhotoId) {
        setLightbox((current) => (current ? null : current));
        return;
      }
      const matching = photos.find((p) => p.id === routePhotoId);
      if (matching) {
        setLightbox((current) => (current?.id === matching.id ? current : matching));
        return;
      }
      const deepLinkedPhoto = await fetchSinglePhoto(routePhotoId);
      if (cancelled || !deepLinkedPhoto) return;
      setLightbox((current) => current?.id === deepLinkedPhoto.id ? current : deepLinkedPhoto);
    }
    syncLightboxWithRoute();
    return () => { cancelled = true; };
  }, [routePhotoId, photos, fetchSinglePhoto]);

  useEffect(() => {
    if (pendingScrollToIndex == null) return;
    const frame = window.requestAnimationFrame(() => setPendingScrollToIndex(undefined));
    return () => window.cancelAnimationFrame(frame);
  }, [pendingScrollToIndex]);

  useEffect(() => {
    const targetPhotoId = initialRoutePhotoIdRef.current;
    if (!targetPhotoId || initialDeepLinkScrollCompleteRef.current || loading) return;
    const targetIndex = photos.findIndex((photo) => photo.id === targetPhotoId);
    if (targetIndex >= 0) {
      initialDeepLinkScrollCompleteRef.current = true;
      setPendingScrollToIndex(targetIndex);
      return;
    }
    if (nextCursor && !loadingMore) { void loadMore(); return; }
    if (!nextCursor) initialDeepLinkScrollCompleteRef.current = true;
  }, [photos, nextCursor, loading, loadingMore, loadMore]);

  const openLightbox = useCallback(
    (photo: Photo) => {
      setLightbox(photo);
      window.history.pushState({}, "", `${routeBase}/${gallerySlug}/photo/${encodeURIComponent(photo.id)}`);
      setRoutePhotoId(photo.id);
    },
    [gallerySlug, routeBase]
  );

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    window.history.pushState({}, "", `${routeBase}/${gallerySlug}`);
    setRoutePhotoId(undefined);
  }, [gallerySlug, routeBase]);

  const activePhotoIndex = getActivePhotoIndex(photos, lightbox?.id);
  const canPrev = activePhotoIndex > 0;
  const canNext = activePhotoIndex >= 0 && activePhotoIndex < photos.length - 1;

  const navigateLightboxByOffset = useCallback((offset: -1 | 1) => {
    if (!lightbox) return;
    const currentIndex = getActivePhotoIndex(photos, lightbox.id);
    const targetIndex = getNavigationTargetIndex(currentIndex, photos.length, offset);
    if (targetIndex < 0) return;
    setPendingScrollToIndex(targetIndex);
    openLightbox(photos[targetIndex]);
  }, [lightbox, photos, openLightbox]);

  const openPreviousPhoto = useCallback(() => {
    navigateLightboxByOffset(-1);
  }, [navigateLightboxByOffset]);

  const openNextPhoto = useCallback(() => {
    navigateLightboxByOffset(1);
  }, [navigateLightboxByOffset]);

  useEffect(() => {
    if (!lightbox) return;
    const currentIndex = getActivePhotoIndex(photos, lightbox.id);
    const neighbors = getAdjacentPreloadPhotos(photos, currentIndex);

    for (const neighbor of neighbors) {
      if (preloadedPhotoIdsRef.current.has(neighbor.id)) continue;
      preloadedPhotoIdsRef.current.add(neighbor.id);
      void fetch(`/api/images/${neighbor.r2_key}?variant=full`, { credentials: "include" })
        .catch(() => {
          // Preload failures should not affect visible navigation.
        });
    }
  }, [lightbox, photos]);

  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (node) {
      observerRef.current = new IntersectionObserver(
        (entries) => { if (entries[0].isIntersecting) loadMore(); },
        { threshold: 0.1 }
      );
      observerRef.current.observe(node);
    }
  }, [loadMore]);

  async function handleExport() {
    setExporting(true);
    setExportProgress("Preparing export...");
    try {
      const res = await fetch(`${apiBase}/galleries/${gallerySlug}/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json() as { galleryName: string; photos: { name: string; url: string }[] };
      await exportGallery(data.galleryName, data.photos, (done, total) => {
        setExportProgress(`Downloading ${done} / ${total}...`);
      });
    } catch (err) {
      console.error(err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
      setExportProgress(null);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}${routeBase}/${gallerySlug}`;
    const result = await shareUrl(galleryName || gallerySlug || "Gallery", url);
    setShareState(result);
    setTimeout(() => setShareState("idle"), 2000);
  }

  const shareLabel =
    shareState === "copied" ? "+ Link copied!" :
      shareState === "shared" ? "+ Shared" :
        shareState === "failed" ? "Share failed" :
          "Share";

  const metadata = buildGalleryViewMetadata({
    galleryName,
    gallerySlug,
    tenantName,
    routeBase,
    bannerKey,
  });
  const pageMetadata = usePageMetadata(metadata);

  if (authCheck.outcome === "unknown") {
    return (
      <>
        {pageMetadata}
        <AuthCheckPlaceholder />
      </>
    );
  }

  return (
    <>
      {pageMetadata}
      <AuthCheckBoundary decision={authCheck}>
        <AppShell gallerySlug={gallerySlug}>
          <div className="min-h-screen p-6">
            {expired && (
              <div className="max-w-[480px] mx-auto mt-20 text-center">
                <ErrorMessage message="This gallery has expired and is no longer available." />
                <a href="/" className="text-sm text-neutral-500">Back to galleries</a>
              </div>
            )}

            {!expired && loading && (
              <div className="min-h-screen flex items-center justify-center">
                <SpinnerOverlay />
              </div>
            )}

            {!expired && !loading && (
              <>
                {bannerKey && (
                  <div className="w-full max-h-[340px] overflow-hidden">
                    <img
                      src={`/api/images/${bannerKey}?variant=banner`}
                      alt="Gallery banner"
                      className="w-full h-[340px] object-cover block"
                    />
                  </div>
                )}

                <div className="max-w-[1200px] mx-auto my-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <h1 className="text-[1.75rem] font-bold leading-tight">
                      {galleryName || gallerySlug}
                    </h1>
                    {eventDate && (
                      <div className="text-[0.85rem] text-neutral-500 mt-1">
                        {new Date(eventDate * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                    )}
                  </div>
                  {photos.length > 0 && (
                    <div className="flex gap-2 items-center shrink-0">
                      <button
                        onClick={() => setShowInfo((v) => !v)}
                        title={showInfo ? "Hide photo info overlays" : "Show photo info overlays"}
                        className={`px-3 py-2 border border-neutral-800 rounded-lg text-[0.85rem] font-mono whitespace-nowrap transition-colors cursor-pointer ${showInfo ? "bg-neutral-900 text-neutral-100" : "bg-transparent text-neutral-500"
                          }`}
                      >
                        {showInfo ? "Info on" : "Info off"}
                      </button>
                      <Button
                        onClick={handleShare}
                        title="Share gallery URL"
                        variant="secondary"
                        analyticsId="gallery_share"
                        className={`px-3 py-2 border rounded-lg text-[0.85rem] whitespace-nowrap ${shareState === "shared" || shareState === "copied"
                          ? "bg-amber-400 border-amber-400 text-neutral-950 font-semibold"
                          : "bg-transparent border-neutral-800 text-neutral-100"
                          }`}
                      >
                        {shareLabel}
                      </Button>
                      <Button
                        onClick={handleExport}
                        disabled={exporting}
                        variant="secondary"
                        analyticsId="gallery_download"
                        className={`px-4 py-2 border rounded-lg text-[0.85rem] whitespace-nowrap ${exporting ? "text-neutral-500" : "text-neutral-100"
                          } ${exportDone
                            ? "bg-amber-400 border-amber-400 text-neutral-950 font-semibold"
                            : "bg-transparent border-neutral-800"
                          }`}
                      >
                        {exportDone ? "Saved!" : exporting ? exportProgress : "Download all"}
                      </Button>
                    </div>
                  )}
                </div>

                {error && <ErrorMessage message={error} onRetry={() => { setError(null); setRetryCount((c) => c + 1); }} />}

                <div className="max-w-[1200px] mx-auto">
                  <MasonryGrid
                    photos={photos}
                    total={total}
                    onPhotoClick={openLightbox}
                    showInfo={showInfo}
                    scrollToIndex={pendingScrollToIndex}
                  />
                  <div ref={setSentinel} className="h-px" />
                  {loadingMore && (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  )}
                </div>

                {photos.length === 0 && !error && (
                  <EmptyState message="No photos in this gallery yet." />
                )}

                {lightbox && (
                  <Lightbox
                    r2Key={lightbox.r2_key}
                    alt={lightbox.original_name}
                    filename={lightbox.original_name}
                    onClose={closeLightbox}
                    onPrev={openPreviousPhoto}
                    onNext={openNextPhoto}
                    canPrev={canPrev}
                    canNext={canNext}
                    currentPosition={Math.max(activePhotoIndex + 1, 1)}
                    totalCount={Math.max(photos.length, 1)}
                  />
                )}
              </>
            )}
          </div>
        </AppShell>
      </AuthCheckBoundary>
    </>
  );
}
