import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Masonry, useInfiniteLoader } from "masonic";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { EmptyState } from "@/client/components/EmptyState";
import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { Lightbox } from "@/client/components/Lightbox";
import { exportGallery } from "@/client/lib/exportGallery";

type Photo = {
  id: string;
  r2_key: string;
  original_name: string;
  size: number;
  uploaded_at: number;
  sort_order: number;
};

// ---------------------------------------------------------------------------
// Masonic grid — isolated component so masonic's internal hooks don't cause
// the parent GalleryView to re-render on every scroll/resize event.
// ---------------------------------------------------------------------------
function PhotoCard({ data: photo, width, index }: { data: Photo; width: number; index: number }) {
  // PhotoThumbnail renders an <img> that masonic will measure after load
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
  onNearEnd,
  onPhotoClick,
  showInfo,
}: {
  photos: Photo[];
  onNearEnd: () => void;
  onPhotoClick: (p: Photo) => void;
  showInfo: boolean;
}) {
  // Attach click handler via a static property to avoid recreating render fn
  (PhotoCard as any)._ctx = { onClick: onPhotoClick, total: photos.length, showInfo };

  const maybeLoadMore = useInfiniteLoader(
    (_startIndex: number, _stopIndex: number, items: unknown[]) => {
      if (items.length > 0) onNearEnd();
    },
    { threshold: 6, minimumBatchSize: 1 }
  );

  return (
    <Masonry
      items={photos}
      render={PhotoCard}
      columnWidth={280}
      columnGutter={12}
      itemKey={(data: Photo) => `${data.id}-${showInfo}`}
      itemHeightEstimate={320}
      onRender={maybeLoadMore}
    />
  );
}

export function GalleryView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [galleryName, setGalleryName] = useState("");
  const [eventDate, setEventDate] = useState<number | null>(null);
  const [bannerKey, setBannerKey] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [showInfo, setShowInfo] = useState(true);

  const fetchPhotos = useCallback(
    async (cursor?: string) => {
      const url = `/api/galleries/${slug}/photos${cursor ? `?cursor=${cursor}` : ""}`;
      const res = await fetch(url, { credentials: "include" });

      if (res.status === 401 || res.status === 403) {
        navigate(`/gallery/${slug}/login`);
        return;
      }

      const data = await res.json() as { photos: Photo[]; nextCursor: string | null };
      return data;
    },
    [slug, navigate]
  );

  useEffect(() => {
    // Load gallery metadata — handle 410 (expired) and 404
    fetch(`/api/galleries/${slug}`)
      .then(async (r) => {
        if (r.status === 410) { setExpired(true); setLoading(false); return null; }
        return r.json() as Promise<{ gallery?: { name: string; is_public: number; banner_r2_key: string | null; event_date: number | null } }>;
      })
      .then(async (d) => {
        if (!d) return;
        setGalleryName(d.gallery?.name ?? "");
        setIsPublic(!!d.gallery?.is_public);
        setBannerKey(d.gallery?.banner_r2_key ?? null);
        setEventDate(d.gallery?.event_date ?? null);
        // Auto-issue viewer JWT for public galleries so photo fetch works
        if (d.gallery?.is_public) {
          await fetch(`/api/viewer/gallery/${slug}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ password: "" }),
          });
        }
      })
      .catch(() => { });

    // Load initial photos
    setLoading(true);
    fetchPhotos()
      .then((data) => {
        if (data) {
          setPhotos(data.photos ?? []);
          setNextCursor(data.nextCursor ?? null);
        }
      })
      .catch(() => setError("Failed to load photos"))
      .finally(() => setLoading(false));
  }, [slug, fetchPhotos]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPhotos(nextCursor);
      if (data) {
        setPhotos((prev) => [...prev, ...(data.photos ?? [])]);
        setNextCursor(data.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress("Preparing export…");
    try {
      const res = await fetch(`/api/galleries/${slug}/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json() as { galleryName: string; photos: { name: string; url: string }[] };
      await exportGallery(data.galleryName, data.photos, (done, total) => {
        setExportProgress(`Downloading ${done} / ${total}…`);
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

  return (
    <div style={{ minHeight: "100vh", padding: "24px" }}>
      {/* Expired gallery message */}
      {expired && (
        <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
          <ErrorMessage message="This gallery has expired and is no longer available." />
          <a href="/" style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>← Back to galleries</a>
        </div>
      )}

      {!expired && (
        <>
          {/* Banner */}
          {bannerKey && (
            <div style={{ width: "100%", maxHeight: 340, overflow: "hidden", marginBottom: 0 }}>
              <img
                src={`/api/images/${bannerKey}?variant=thumb`}
                alt="Gallery banner"
                style={{ width: "100%", height: 340, objectFit: "cover", display: "block" }}
              />
            </div>
          )}

          {/* Header */}
          <div
            style={{
              maxWidth: 1200,
              margin: "32px auto 32px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px 16px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                {galleryName || slug}
              </h1>
              {eventDate && (
                <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginTop: 4 }}>
                  📅 {new Date(eventDate * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </div>
              )}
            </div>
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <button
                  onClick={() => setShowInfo((v) => !v)}
                  title={showInfo ? "Hide photo info overlays" : "Show photo info overlays"}
                  style={{
                    padding: "8px 12px",
                    background: showInfo ? "var(--color-surface)" : "none",
                    border: `1px solid var(--color-border)`,
                    borderRadius: "var(--radius)",
                    color: showInfo ? "var(--color-text)" : "var(--color-text-muted)",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.2s, color 0.2s",
                    fontFamily: "'Courier New', Courier, monospace",
                  }}
                >
                  {showInfo ? "Info on" : "Info off"}
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  style={{
                    padding: "8px 16px",
                    background: exportDone ? "var(--color-accent)" : "none",
                    border: `1px solid ${exportDone ? "var(--color-accent)" : "var(--color-border)"}`,
                    borderRadius: "var(--radius)",
                    color: exportDone ? "#0f0f0f" : exporting ? "var(--color-text-muted)" : "var(--color-text)",
                    fontSize: "0.85rem",
                    fontWeight: exportDone ? 600 : 400,
                    cursor: exporting ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    transition: "background 0.2s, color 0.2s, border-color 0.2s",
                  }}
                >
                  {exportDone ? "✓ Saved!" : exporting ? exportProgress : "⬇ Download all"}
                </button>
              </div>
            )}
          </div>

          {loading && <SpinnerOverlay />}
          {error && <ErrorMessage message={error} onRetry={() => {
            setLoading(true);
            fetchPhotos()
              .then((data) => { if (data) { setPhotos(data.photos ?? []); setNextCursor(data.nextCursor ?? null); } })
              .catch(() => setError("Failed to load photos"))
              .finally(() => setLoading(false));
          }} />}

          {/* Photo grid */}
          {!loading && (
            <div style={{ maxWidth: 1200, margin: "0 auto" }}>
              <MasonryGrid photos={photos} onNearEnd={loadMore} onPhotoClick={setLightbox} showInfo={showInfo} />
            </div>
          )}

          {!loading && photos.length === 0 && !error && (
            <EmptyState message="No photos in this gallery yet." />
          )}

          {lightbox && (
            <Lightbox
              r2Key={lightbox.r2_key}
              alt={lightbox.original_name}
              filename={lightbox.original_name}
              onClose={() => setLightbox(null)}
            />
          )}
        </>
      )}
    </div>
  );
}


