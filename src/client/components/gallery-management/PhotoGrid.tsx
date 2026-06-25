import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationModal } from "@/client/components/ConfirmationModal";
import { ErrorMessage } from "@/client/components/ErrorMessage";
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

type DeleteRequest = {
  photoIds: string[];
  title: string;
  description: string;
  confirmLabel: string;
};

export function PhotoGrid({
  galleryId,
  gallery,
  photos,
  onPhotosChange,
  onGalleryUpdated,
}: Props) {
  const { apiBase } = useTenant();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const photoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<string[]>([]);
  const [settingBanner, setSettingBanner] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(photos[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const validIds = new Set(photos.map((photo) => photo.id));
    setSelectedPhotoIds((current) => current.filter((photoId) => validIds.has(photoId)));
    setActivePhotoId((current) => {
      if (current && validIds.has(current)) return current;
      return photos[0]?.id ?? null;
    });
  }, [photos]);

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const selectedCount = selectedPhotoIds.length;
  const deletingSet = useMemo(() => new Set(deletingPhotoIds), [deletingPhotoIds]);

  function focusPhoto(photoId: string) {
    setActivePhotoId(photoId);
    photoRefs.current[photoId]?.focus();
  }

  function toggleSelection(photoId: string) {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((currentId) => currentId !== photoId)
        : [...current, photoId]
    );
  }

  function selectAll() {
    setSelectedPhotoIds(photos.map((photo) => photo.id));
  }

  function selectNone() {
    setSelectedPhotoIds([]);
  }

  function getColumnCount() {
    const items = gridRef.current?.querySelectorAll<HTMLElement>("[data-photo-tile='true']");
    if (!items || items.length === 0) return 1;
    const firstTop = items[0].offsetTop;
    let columns = 0;
    for (const item of items) {
      if (columns > 0 && item.offsetTop !== firstTop) break;
      columns += 1;
    }
    return Math.max(columns, 1);
  }

  function moveFocus(currentId: string, delta: number) {
    const currentIndex = photos.findIndex((photo) => photo.id === currentId);
    if (currentIndex === -1) return;
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), photos.length - 1);
    focusPhoto(photos[nextIndex].id);
  }

  function requestDelete(photoIds: string[]) {
    const items = photos.filter((photo) => photoIds.includes(photo.id));
    if (items.length === 0) return;

    const singlePhoto = items.length === 1 ? items[0] : null;
    setDeleteRequest({
      photoIds: items.map((photo) => photo.id),
      title: singlePhoto ? `Delete "${singlePhoto.original_name}"?` : `Delete ${items.length} selected photos?`,
      description: singlePhoto
        ? "This photo will be permanently removed from the gallery."
        : "These photos will be permanently removed from the gallery.",
      confirmLabel: singlePhoto ? "Delete photo" : "Delete selected",
    });
  }

  async function performDelete(photoIds: string[]) {
    setError(null);
    setDeletingPhotoIds(photoIds);
    try {
      for (const photoId of photoIds) {
        const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/photos/${photoId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error();
      }

      const deletedIds = new Set(photoIds);
      const deletedBanner = gallery?.banner_photo_id ? deletedIds.has(gallery.banner_photo_id) : false;
      onPhotosChange((current) => current.filter((photo) => !deletedIds.has(photo.id)));
      setSelectedPhotoIds((current) => current.filter((photoId) => !deletedIds.has(photoId)));

      if (deletedBanner) {
        onGalleryUpdated((current) => ({
          ...current,
          banner_photo_id: null,
          banner_r2_key: null,
        }));
      }
    } catch {
      setError("Failed to delete one or more photos.");
    } finally {
      setDeletingPhotoIds([]);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteRequest) return;
    setConfirmingDelete(true);
    try {
      await performDelete(deleteRequest.photoIds);
      setDeleteRequest(null);
    } finally {
      setConfirmingDelete(false);
    }
  }

  async function handleSetBanner(photoId: string) {
    if (!gallery) return;
    setError(null);
    setSettingBanner(true);
    const isCurrent = gallery.banner_photo_id === photoId;
    const newBannerId = isCurrent ? null : photoId;
    const newBannerKey = isCurrent
      ? null
      : (photos.find((photo) => photo.id === photoId)?.r2_key ?? null);

    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/banner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoId: newBannerId }),
      });
      if (!res.ok) throw new Error();
      onGalleryUpdated((current) => ({
        ...current,
        banner_photo_id: newBannerId,
        banner_r2_key: newBannerKey,
      }));
    } catch {
      setError("Failed to update the gallery banner.");
    } finally {
      setSettingBanner(false);
    }
  }

  function handleTileKeyDown(event: React.KeyboardEvent<HTMLDivElement>, photoId: string) {
    if (event.target !== event.currentTarget) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAll();
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(photoId, -1);
        return;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(photoId, 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(photoId, -getColumnCount());
        return;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(photoId, getColumnCount());
        return;
      case " ":
      case "x":
      case "X":
        event.preventDefault();
        toggleSelection(photoId);
        return;
      case "Escape":
        event.preventDefault();
        selectNone();
        return;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        requestDelete(selectedCount > 0 ? selectedPhotoIds : [photoId]);
        return;
      case "b":
      case "B":
        event.preventDefault();
        if (selectedCount === 1) {
          void handleSetBanner(selectedPhotoIds[0]);
          return;
        }
        void handleSetBanner(photoId);
        return;
      default:
        return;
    }
  }

  const bannerTargetId = selectedCount === 1 ? selectedPhotoIds[0] : activePhotoId;

  return (
    <>
      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-100">
              {selectedCount > 0 ? `${selectedCount} selected` : "No photos selected"}
            </span>
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={selectNone}
              disabled={selectedCount === 0}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 disabled:opacity-50"
            >
              Select none
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (bannerTargetId ? void handleSetBanner(bannerTargetId) : undefined)}
              disabled={!bannerTargetId || settingBanner || deletingPhotoIds.length > 0}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-100 disabled:opacity-50"
            >
              {settingBanner ? "Saving..." : selectedCount === 1 ? "Star selected" : "Star focused"}
            </button>
            <button
              type="button"
              onClick={() => requestDelete(selectedPhotoIds)}
              disabled={selectedCount === 0 || deletingPhotoIds.length > 0}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
            >
              {deletingPhotoIds.length > 0 ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-[0.78rem] text-neutral-500">
          Arrow keys move focus. Space or X selects. B stars the focused photo. Delete removes the
          selection. Esc clears selection.
        </p>
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <div
        ref={gridRef}
        role="listbox"
        aria-label="Gallery photos"
        aria-multiselectable="true"
        className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
      >
        {photos.map((photo) => {
          const isBanner = gallery?.banner_photo_id === photo.id;
          const isSelected = selectedSet.has(photo.id);
          const isActive = activePhotoId === photo.id;
          const isDeleting = deletingSet.has(photo.id);

          return (
            <div
              key={photo.id}
              data-photo-tile="true"
              ref={(node) => {
                photoRefs.current[photo.id] = node;
              }}
              role="option"
              aria-selected={isSelected}
              tabIndex={isActive ? 0 : -1}
              onFocus={() => setActivePhotoId(photo.id)}
              onClick={() => setActivePhotoId(photo.id)}
              onKeyDown={(event) => handleTileKeyDown(event, photo.id)}
              className={`rounded-lg border bg-neutral-900 p-3 outline-none transition-colors ${isSelected
                ? "border-amber-400"
                : isActive
                  ? "border-neutral-600"
                  : "border-neutral-800"
                } ${isDeleting ? "opacity-60" : ""}`}
            >
              <div className="relative">
                <PhotoThumbnail
                  r2Key={photo.r2_key}
                  alt={photo.original_name}
                  fit="cover"
                  style={{ marginBottom: 10 }}
                />
                <button
                  type="button"
                  onClick={() => void handleSetBanner(photo.id)}
                  disabled={settingBanner}
                  title={isBanner ? "Remove banner" : "Set as banner"}
                  aria-label={isBanner ? "Remove banner photo" : "Set as banner photo"}
                  className={`absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded border-0 p-0 text-sm leading-none ${isBanner ? "bg-amber-400 text-neutral-950" : "bg-black/55 text-white"
                    }`}
                >
                  {isBanner ? "\u2605" : "\u2606"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelection(photo.id)}
                  aria-pressed={isSelected}
                  aria-label={isSelected ? "Deselect photo" : "Select photo"}
                  className={`absolute right-1.5 top-1.5 flex h-7 min-w-7 items-center justify-center rounded border px-1.5 text-xs ${isSelected
                    ? "border-amber-400 bg-amber-400 text-neutral-950"
                    : "border-neutral-700 bg-black/55 text-white"
                    }`}
                >
                  {isSelected ? "✓" : "○"}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-neutral-100">
                    {photo.original_name}
                  </div>
                  <div className="text-[0.75rem] text-neutral-500">{formatSize(photo.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => requestDelete([photo.id])}
                  disabled={isDeleting}
                  title="Delete photo"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-transparent p-0 text-xs text-red-400 disabled:opacity-50"
                >
                  {isDeleting ? "..." : "X"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmationModal
        open={!!deleteRequest}
        title={deleteRequest?.title ?? ""}
        description={deleteRequest?.description ?? ""}
        confirmLabel={deleteRequest?.confirmLabel ?? "Delete"}
        loading={confirmingDelete}
        onCancel={() => {
          if (!confirmingDelete) setDeleteRequest(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
