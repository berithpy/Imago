import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { exportGallery } from "@/client/lib/exportGallery";
import { formatDate, type Gallery } from "@/client/lib/galleryManagement";
import { useTenant } from "@/client/lib/tenantContext";
import { copyToClipboard, shareUrl } from "@/client/lib/share";

type Props = {
  galleryId: string;
  gallery: Gallery | null;
  hasPhotos: boolean;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onGalleryUpdated: (updater: (current: Gallery) => Gallery) => void;
  onPermanentDeleteSuccess: () => void;
  uploadControl?: ReactNode;
};

const ghostBtnClass =
  "px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer disabled:opacity-50";
const dangerBtnClass =
  "px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-red-400 text-sm cursor-pointer disabled:opacity-50";

function buildAbsoluteUrl(routeBase: string, slug: string): string {
  return `${window.location.origin}${routeBase}/${slug}`;
}

export function GalleryManagementHeader({
  galleryId,
  gallery,
  hasPhotos,
  settingsOpen,
  onToggleSettings,
  onGalleryUpdated,
  onPermanentDeleteSuccess,
  uploadControl,
}: Props) {
  const { apiBase, routeBase } = useTenant();
  const [deletingGallery, setDeletingGallery] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");

  async function handleTogglePublic() {
    if (!gallery) return;
    const next = !gallery.is_public;
    await fetch(`${apiBase}/admin/galleries/${galleryId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_public: next }),
    });
    onGalleryUpdated((current) => ({ ...current, is_public: next ? 1 : 0 }));
  }

  async function handleSoftDelete() {
    if (!gallery) return;
    if (!confirm(`Hide "${gallery.name}" from viewers? You can restore it later.`)) return;
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}`, { method: "DELETE", credentials: "include" });
      onGalleryUpdated((current) => ({ ...current, deleted_at: Math.floor(Date.now() / 1000) }));
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleRestore() {
    if (!gallery) return;
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/restore`, { method: "POST", credentials: "include" });
      onGalleryUpdated((current) => ({ ...current, deleted_at: null }));
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handlePermanentDelete() {
    if (!gallery) return;
    if (!confirm(`Permanently delete "${gallery.name}" and ALL its photos? This cannot be undone.`)) return;
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/permanent`, { method: "DELETE", credentials: "include" });
      onPermanentDeleteSuccess();
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress("Preparing export...");
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const data = (await res.json()) as { galleryName: string; photos: { name: string; url: string }[] };
      await exportGallery(data.galleryName, data.photos, (done, total) => {
        setExportProgress(`Downloading ${done} / ${total}...`);
      });
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  async function handleCopyUrl() {
    if (!gallery) return;
    const url = buildAbsoluteUrl(routeBase, gallery.slug);
    const ok = await copyToClipboard(url);
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), 2000);
  }

  async function handleShare() {
    if (!gallery) return;
    const url = buildAbsoluteUrl(routeBase, gallery.slug);
    const result = await shareUrl(gallery.name, url);
    setShareState(result);
    setTimeout(() => setShareState("idle"), 2000);
  }

  const shareLabel =
    shareState === "copied" ? "+ Link copied!" :
      shareState === "shared" ? "+ Shared" :
        shareState === "failed" ? "Share failed" :
          "Share";

  return (
    <div className="flex flex-wrap justify-between items-start mb-8 gap-5">
      <div className="min-w-0">
        <Link to={`${routeBase}/manage`} className="text-sm text-neutral-500">
          Back to galleries
        </Link>
        <div className="mt-2 text-[0.72rem] tracking-[0.08em] text-neutral-500 font-semibold">
          GALLERY MANAGEMENT
        </div>
        <h1 className="text-[1.75rem] font-bold mt-1">
          {gallery?.name ?? "Gallery"}
        </h1>

        {gallery && (
          <div className="flex items-center gap-2 mt-1">
            <a
              href={`${routeBase}/${gallery.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-neutral-500 hover:text-amber-400"
            >
              {routeBase}/{gallery.slug}
            </a>
            <button
              onClick={handleCopyUrl}
              title="Copy full URL"
              aria-label="Copy full URL"
              className="inline-flex items-center justify-center w-7 h-7 bg-transparent border border-neutral-800 rounded-md text-neutral-500 text-xs cursor-pointer hover:text-amber-400 hover:border-amber-400 transition-colors"
            >
              {copyState === "copied" ? "+" : copyState === "failed" ? "X" : "Copy"}
            </button>
            {copyState === "copied" && (
              <span className="text-xs text-amber-400">Copied!</span>
            )}
          </div>
        )}

        {gallery?.deleted_at && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-500 font-semibold tracking-[0.04em]">
            HIDDEN
          </span>
        )}
        {gallery?.event_date && (
          <div className="text-[0.8rem] text-neutral-500 mt-1">
            {formatDate(gallery.event_date)}
          </div>
        )}
        {gallery?.expires_at && (
          <div
            className={`text-[0.8rem] mt-0.5 ${gallery.expires_at * 1000 < Date.now() ? "text-red-400" : "text-neutral-500"
              }`}
          >
            Expires {formatDate(gallery.expires_at)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 items-center justify-end">
        {gallery && (
          <button
            onClick={handleTogglePublic}
            title={gallery.is_public ? "Make private" : "Make public"}
            className={`px-4 py-2 border border-neutral-800 rounded-lg text-sm cursor-pointer ${gallery.is_public
              ? "bg-amber-400 text-neutral-950 font-semibold"
              : "bg-transparent text-neutral-500"
              }`}
          >
            {gallery.is_public ? "Public" : "Private"}
          </button>
        )}
        {gallery && (gallery.deleted_at ? (
          <>
            <button onClick={handleRestore} disabled={deletingGallery} className={ghostBtnClass}>Restore</button>
            <button onClick={handlePermanentDelete} disabled={deletingGallery} className={dangerBtnClass}>
              Delete forever
            </button>
          </>
        ) : (
          <button onClick={handleSoftDelete} disabled={deletingGallery} className={dangerBtnClass}>
            Hide gallery
          </button>
        ))}
        <button
          onClick={onToggleSettings}
          aria-pressed={settingsOpen}
          title={settingsOpen ? "Close settings" : "Open settings"}
          className={`px-4 py-2 border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer ${settingsOpen ? "bg-neutral-800" : "bg-transparent"
            }`}
        >
          {settingsOpen ? "Close settings" : "Settings"}
        </button>
        {gallery && (
          <button
            onClick={handleShare}
            title="Share gallery URL"
            className={`px-4 py-2 border rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors ${shareState === "shared" || shareState === "copied"
              ? "bg-amber-400 border-amber-400 text-neutral-950 font-semibold"
              : "bg-transparent border-neutral-800 text-neutral-100"
              }`}
          >
            {shareLabel}
          </button>
        )}
        {hasPhotos && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`px-4 py-2 border rounded-lg text-sm whitespace-nowrap transition-colors ${exporting ? "cursor-not-allowed text-neutral-500" : "cursor-pointer text-neutral-100"
              } ${exportDone
                ? "bg-amber-400 border-amber-400 text-neutral-950 font-semibold"
                : "bg-transparent border-neutral-800"
              }`}
          >
            {exportDone ? "Saved!" : exporting ? exportProgress : "Export zip"}
          </button>
        )}
        {uploadControl}
      </div>
    </div>
  );
}
