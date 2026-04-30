import { useState } from "react";
import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { useTenant } from "@/client/lib/tenantContext";
import type { Gallery, Photo } from "@/client/lib/galleryManagement";
import { formatSize } from "@/client/lib/galleryManagement";

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
  const { apiBase } = useTenant();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingBanner, setSettingBanner] = useState(false);

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
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
      {photos.map((photo) => {
        const isBanner = gallery?.banner_photo_id === photo.id;
        return (
          <div key={photo.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
            <div className="relative">
              <PhotoThumbnail
                r2Key={photo.r2_key}
                alt={photo.original_name}
                fit="cover"
                style={{ marginBottom: 10 }}
              />
              <button
                onClick={() => handleSetBanner(photo.id)}
                disabled={settingBanner}
                title={isBanner ? "Remove banner" : "Set as banner"}
                className={`absolute top-1.5 left-1.5 border-0 rounded text-sm px-1.5 py-0.5 cursor-pointer leading-relaxed ${isBanner ? "bg-amber-400 text-neutral-950" : "bg-black/55 text-white"
                  }`}
              >
                *
              </button>
            </div>

            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0">
                <div className="text-xs text-neutral-100 font-medium truncate">
                  {photo.original_name}
                </div>
                <div className="text-[0.75rem] text-neutral-500">{formatSize(photo.size)}</div>
              </div>
              <button
                onClick={() => handleDelete(photo.id, photo.original_name)}
                disabled={deleting === photo.id}
                title="Delete photo"
                className={`shrink-0 w-7 h-7 flex items-center justify-center bg-transparent border border-neutral-800 rounded-lg text-red-400 text-xs cursor-pointer p-0 ${deleting === photo.id ? "opacity-50" : ""
                  }`}
              >
                {deleting === photo.id ? "..." : "X"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
