import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { dangerButtonStyle, ghostButtonStyle } from "@/client/components/ui";
import { exportGallery } from "@/client/lib/exportGallery";
import { formatDate, type Gallery } from "@/client/lib/galleryManagement";
import { useTenant } from "@/client/lib/tenantContext";

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
  const [deletingGallery, setDeletingGallery] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const { apiBase, routeBase } = useTenant();

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
      await fetch(`${apiBase}/admin/galleries/${galleryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      onGalleryUpdated((current) => ({ ...current, deleted_at: Math.floor(Date.now() / 1000) }));
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleRestore() {
    if (!gallery) return;
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/restore`, {
        method: "POST",
        credentials: "include",
      });
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
      await fetch(`${apiBase}/admin/galleries/${galleryId}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      onPermanentDeleteSuccess();
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress("Preparing export…");
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/export`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const data = (await res.json()) as {
        galleryName: string;
        photos: { name: string; url: string }[];
      };
      await exportGallery(data.galleryName, data.photos, (done, total) => {
        setExportProgress(`Downloading ${done} / ${total}…`);
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

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 32,
        gap: 20,
      }}
    >
      <div>
        <Link
          to={`${routeBase}/admin`}
          style={{
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
            textDecoration: "none",
          }}
        >
          ← Back to galleries
        </Link>
        <div style={{ marginTop: 8, fontSize: "0.72rem", letterSpacing: "0.08em", color: "var(--color-text-muted)", fontWeight: 600 }}>
          GALLERY MANAGEMENT
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 4 }}>
          {gallery?.name ?? "Gallery"}
        </h1>
        {gallery && (
          <a
            href={`${routeBase}/${gallery.slug}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}
          >
            {routeBase}/{gallery.slug} ↗
          </a>
        )}
        {gallery?.deleted_at && (
          <span
            style={{
              display: "inline-block",
              marginTop: 4,
              fontSize: "0.75rem",
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            HIDDEN
          </span>
        )}
        {gallery?.event_date && (
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
            📅 {formatDate(gallery.event_date)}
          </div>
        )}
        {gallery?.expires_at && (
          <div
            style={{
              fontSize: "0.8rem",
              color:
                gallery.expires_at * 1000 < Date.now()
                  ? "var(--color-error)"
                  : "var(--color-text-muted)",
              marginTop: 2,
            }}
          >
            ⏳ Expires {formatDate(gallery.expires_at)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {gallery && (
          <button
            onClick={handleTogglePublic}
            title={gallery.is_public ? "Make private" : "Make public"}
            style={{
              padding: "7px 14px",
              background: gallery.is_public ? "var(--color-accent)" : "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: gallery.is_public ? "#0f0f0f" : "var(--color-text-muted)",
              fontSize: "0.85rem",
              fontWeight: gallery.is_public ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {gallery.is_public ? "🌐 Public" : "🔒 Private"}
          </button>
        )}
        {gallery &&
          (gallery.deleted_at ? (
            <>
              <button
                onClick={handleRestore}
                disabled={deletingGallery}
                style={{ ...ghostButtonStyle, fontSize: "0.85rem" }}
              >
                Restore
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deletingGallery}
                style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}
              >
                Delete forever
              </button>
            </>
          ) : (
            <button
              onClick={handleSoftDelete}
              disabled={deletingGallery}
              style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}
            >
              Hide gallery
            </button>
          ))}
        <button
          onClick={onToggleSettings}
          aria-pressed={settingsOpen}
          title={settingsOpen ? "Close settings" : "Open settings"}
          style={{
            padding: "7px 14px",
            background: settingsOpen ? "var(--color-border)" : "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text-muted)",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          {settingsOpen ? "✕ Close settings" : "⚙ Settings"}
        </button>
        {hasPhotos && (
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: "7px 14px",
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
            {exportDone ? "✓ Saved!" : exporting ? exportProgress : "⬇ Export zip"}
          </button>
        )}
        {uploadControl}
      </div>
    </div>
  );
}
