import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { cardSmallStyle, formatSize, iconButtonStyle } from "@/client/components/ui";
import type { Gallery, Photo } from "@/client/lib/galleryManagement";
import { useState } from "react";
import { useTenant } from "@/client/lib/tenantContext";

type Props = {
  galleryId: string;
  gallery: Gallery | null;
  photos: Photo[];
  onPhotosChange: (updater: (current: Photo[]) => Photo[]) => void;
  onGalleryUpdated: (updater: (current: Gallery) => Gallery) => void;
};

export function GalleryManagementPhotoGrid({
  galleryId,
  gallery,
  photos,
  onPhotosChange,
  onGalleryUpdated,
}: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingBanner, setSettingBanner] = useState(false);
  const { apiBase } = useTenant();

  async function handleDelete(photoId: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(photoId);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/photos/${photoId}`, {
        method: "DELETE",
        credentials: "include",
      });
      onPhotosChange((current) => current.filter((photo) => photo.id !== photoId));
    } finally {
      setDeleting(null);
    }
  }

  async function handleSetBanner(photoId: string) {
    if (!gallery) return;
    setSettingBanner(true);
    const isCurrent = gallery.banner_photo_id === photoId;
    const newBannerId = isCurrent ? null : photoId;
    const newBannerKey = isCurrent
      ? null
      : (photos.find((photo) => photo.id === photoId)?.r2_key ?? null);

    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/banner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoId: newBannerId }),
      });
      onGalleryUpdated((current) => ({
        ...current,
        banner_photo_id: newBannerId,
        banner_r2_key: newBannerKey,
      }));
    } finally {
      setSettingBanner(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 16,
      }}
    >
      {photos.map((photo) => (
        <div key={photo.id} style={cardSmallStyle}>
          <div style={{ position: "relative" }}>
            <PhotoThumbnail
              r2Key={photo.r2_key}
              alt={photo.original_name}
              fit="cover"
              style={{ marginBottom: 10 }}
            />
            <button
              onClick={() => handleSetBanner(photo.id)}
              disabled={settingBanner}
              title={gallery?.banner_photo_id === photo.id ? "Remove banner" : "Set as banner"}
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                background:
                  gallery?.banner_photo_id === photo.id
                    ? "var(--color-accent)"
                    : "rgba(0,0,0,0.55)",
                border: "none",
                borderRadius: 4,
                color: gallery?.banner_photo_id === photo.id ? "#0f0f0f" : "white",
                fontSize: "0.8rem",
                padding: "2px 6px",
                cursor: "pointer",
                lineHeight: 1.6,
              }}
            >
              ★
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text)",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {photo.original_name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {formatSize(photo.size)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(photo.id, photo.original_name)}
              disabled={deleting === photo.id}
              style={{ ...iconButtonStyle, opacity: deleting === photo.id ? 0.5 : 1 }}
              title="Delete photo"
            >
              {deleting === photo.id ? "…" : "✕"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
