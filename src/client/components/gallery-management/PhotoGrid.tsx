import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useLongPress } from "@uidotdev/usehooks";
import { CopyCheck, Grid2X2, Grid3X3, Info, SquareDashed } from "lucide-react";
import { ConfirmationModal } from "@/client/components/ConfirmationModal";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { useTenant } from "@/client/lib/tenantContext";
import type { Gallery, Photo } from "@/client/lib/galleryManagement";
import { formatSize } from "@/client/lib/galleryManagement";
import {
  getAvailableGalleryViewModes,
  getDefaultGalleryViewMode,
  getSafeGalleryViewMode,
  shouldShowKeyboardHint,
  type GalleryManagementViewMode,
} from "@/client/lib/galleryManagementViewMode";

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

type PhotoTileProps = {
  photo: Photo;
  index: number;
  total: number;
  isListMode: boolean;
  isSmallGridMode: boolean;
  isBanner: boolean;
  isSelected: boolean;
  isActive: boolean;
  isCursorActive: boolean;
  isDeleting: boolean;
  settingBanner: boolean;
  showInfo: boolean;
  isTouchDevice: boolean;
  isMultiSelectMode: boolean;
  onFocus: () => void;
  onActivate: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onSetBanner: () => void;
  onPreview: () => void;
  onToggleMark: () => void;
  onLongPressMark: () => void;
};

const PhotoTile = forwardRef<HTMLDivElement, PhotoTileProps>(function PhotoTile({
  photo,
  index,
  total,
  isListMode,
  isSmallGridMode,
  isBanner,
  isSelected,
  isActive,
  isCursorActive,
  isDeleting,
  settingBanner,
  showInfo,
  isTouchDevice,
  isMultiSelectMode,
  onFocus,
  onActivate,
  onKeyDown,
  onSetBanner,
  onPreview,
  onToggleMark,
  onLongPressMark,
}, ref) {
  const suppressTapAfterHoldRef = useRef(false);

  const longPressAttrs = useLongPress(
    () => {
      if (!isTouchDevice) return;
      suppressTapAfterHoldRef.current = true;
      if (isMultiSelectMode) return;

      onLongPressMark();
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(20);
      }
    }
  );

  return (
    <div
      ref={ref}
      data-photo-tile="true"
      role="option"
      aria-selected={isSelected}
      tabIndex={isActive ? 0 : -1}
      onFocus={onFocus}
      onClick={() => {
        if (isTouchDevice && suppressTapAfterHoldRef.current) {
          suppressTapAfterHoldRef.current = false;
          return;
        }
        if (isMultiSelectMode) {
          onToggleMark();
          onFocus();
          return;
        }
        onActivate();
      }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        if (isTouchDevice) event.preventDefault();
      }}
      {...longPressAttrs}
      className={`group relative select-none border bg-neutral-900 outline-none transition-colors focus-visible:border-amber-400 focus-visible:bg-neutral-800 focus-visible:ring-1 focus-visible:ring-amber-400/70 ${isListMode ? "p-2.5" : "p-3"} ${isCursorActive
        ? "border-amber-400 bg-amber-400/10"
        : isSelected
          ? "border-neutral-200 bg-neutral-700/70"
          : "border-neutral-800 hover:border-neutral-500 hover:bg-neutral-700/45"
        } ${isDeleting ? "opacity-60" : ""}`}
    >
      <PhotoThumbnail
        r2Key={photo.r2_key}
        alt={photo.original_name}
        fit="cover"
        sharp
        onClick={(event) => {
          if (isTouchDevice && suppressTapAfterHoldRef.current) {
            event.stopPropagation();
            suppressTapAfterHoldRef.current = false;
            return;
          }
          if (isMultiSelectMode) return;

          onPreview();
        }}
        index={showInfo ? index + 1 : undefined}
        total={showInfo ? total : undefined}
        marked={showInfo ? isSelected : false}
        showBannerBadge={showInfo}
        bannerActive={isBanner}
        onBannerClick={() => {
          void onSetBanner();
        }}
        filename={showInfo ? photo.original_name : undefined}
        size={showInfo ? formatSize(photo.size) : undefined}
        onIndexClick={showInfo ? onToggleMark : undefined}
      />
    </div>
  );
});

export function PhotoGrid({
  galleryId,
  gallery,
  photos,
  onPhotosChange,
  onGalleryUpdated,
}: Props) {
  const { apiBase } = useTenant();
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const photoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [deletingPhotoIds, setDeletingPhotoIds] = useState<string[]>([]);
  const [settingBanner, setSettingBanner] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(photos[0]?.id ?? null);
  const [viewportWidth, setViewportWidth] = useState<number>(() => window.innerWidth);
  const [viewMode, setViewMode] = useState<GalleryManagementViewMode>(() =>
    getDefaultGalleryViewMode(window.innerWidth)
  );
  const [error, setError] = useState<string | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  });

  useEffect(() => {
    const validIds = new Set(photos.map((photo) => photo.id));
    setSelectedPhotoIds((current) => current.filter((photoId) => validIds.has(photoId)));
    setActivePhotoId((current) => {
      if (current && validIds.has(current)) return current;
      return photos[0]?.id ?? null;
    });
  }, [photos]);

  useEffect(() => {
    function syncViewportMode() {
      setViewportWidth(window.innerWidth);
      setViewMode((current) => getSafeGalleryViewMode(current, window.innerWidth));
    }

    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const updateTouchMode = () => setIsTouchDevice(mediaQuery.matches);
    updateTouchMode();
    mediaQuery.addEventListener("change", updateTouchMode);
    return () => mediaQuery.removeEventListener("change", updateTouchMode);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const selectedCount = selectedPhotoIds.length;
  const deletingSet = useMemo(() => new Set(deletingPhotoIds), [deletingPhotoIds]);
  const availableViewModes = useMemo(
    () => getAvailableGalleryViewModes(viewportWidth),
    [viewportWidth]
  );
  const showKeyboardNavHint = shouldShowKeyboardHint(viewportWidth);
  const isListMode = viewMode === "list";
  const isSmallGridMode = viewMode === "small-grid";

  function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return !!target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox']");
  }

  function isInsideDialog(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest("dialog, [role='dialog'], [aria-modal='true']");
  }

  function ensurePhotoVisible(photoId: string) {
    const tile = photoRefs.current[photoId];
    if (!tile) return;

    const tileRect = tile.getBoundingClientRect();
    const controlsBottom = controlsRef.current?.getBoundingClientRect().bottom ?? 0;
    const topSafeEdge = controlsBottom + 10;
    const bottomSafeEdge = window.innerHeight - 8;

    if (tileRect.top < topSafeEdge) {
      window.scrollBy({ top: tileRect.top - topSafeEdge, behavior: "auto" });
      return;
    }

    if (tileRect.bottom > bottomSafeEdge) {
      window.scrollBy({ top: tileRect.bottom - bottomSafeEdge, behavior: "auto" });
    }
  }

  function focusPhoto(photoId: string) {
    setActivePhotoId(photoId);
    photoRefs.current[photoId]?.focus();
    window.requestAnimationFrame(() => {
      ensurePhotoVisible(photoId);
    });
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

  useEffect(() => {
    // Keep a window-level key handler so arrow navigation can start before any tile is focused.
    // The tile-level handler remains for focused listbox interactions (selection/star/delete shortcuts).
    function onWindowKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || photos.length === 0 || deleteRequest) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target) || isInsideDialog(event.target)) return;

      const currentId = activePhotoId ?? photos[0]?.id;
      if (!currentId) return;

      const isArrowKey =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown";

      if (!keyboardMode && isArrowKey) {
        event.preventDefault();
        setKeyboardMode(true);
        focusPhoto(currentId);
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          moveFocus(currentId, -1);
          return;
        case "ArrowRight":
          event.preventDefault();
          moveFocus(currentId, 1);
          return;
        case "ArrowUp":
          event.preventDefault();
          moveFocus(currentId, -getColumnCount());
          return;
        case "ArrowDown":
          event.preventDefault();
          moveFocus(currentId, getColumnCount());
          return;
        default:
          return;
      }
    }

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [activePhotoId, deleteRequest, keyboardMode, photos]);

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

    const isArrowKey =
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowDown";

    if (!keyboardMode && isArrowKey) {
      event.preventDefault();
      setKeyboardMode(true);
      focusPhoto(photoId);
      return;
    }

    setKeyboardMode(true);

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
      <div
        ref={controlsRef}
        className="sticky top-2 z-30 mb-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-100">
              {selectedCount > 0 ? `${selectedCount} selected` : "No photos selected"}
            </span>
            <div className="ml-1 flex items-center gap-1.5 rounded-lg border border-neutral-800 p-1">
              {availableViewModes.map((mode) => {
                const isActive = mode === viewMode;
                const label = mode === "small-grid"
                  ? "Small grid"
                  : mode === "list"
                    ? "List"
                    : "Grid";
                const Icon = mode === "small-grid" ? Grid3X3 : mode === "grid" ? Grid2X2 : null;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    aria-pressed={isActive}
                    aria-label={label}
                    title={label}
                    className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${isActive
                      ? "bg-amber-400 text-neutral-950"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                      }`}
                  >
                    {Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={selectAll}
              aria-label="Select all"
              title="Select all"
              className="inline-flex items-center rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            >
              <CopyCheck aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={selectNone}
              disabled={selectedCount === 0}
              aria-label="Select none"
              title="Select none"
              className="inline-flex items-center rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
            >
              <SquareDashed aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowInfo((current) => !current)}
              aria-label={showInfo ? "Hide photo info overlays" : "Show photo info overlays"}
              aria-pressed={showInfo}
              title={showInfo ? "Hide photo info overlays" : "Show photo info overlays"}
              className={`inline-flex items-center rounded-lg border border-neutral-800 px-3 py-1.5 text-xs transition-colors cursor-pointer ${showInfo ? "bg-neutral-900 text-neutral-100" : "bg-transparent text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
                }`}
            >
              <Info aria-hidden="true" className="h-4 w-4" />
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
              {deletingPhotoIds.length > 0 ? "Deleting..." : `Delete (${selectedCount})`}
            </button>
          </div>
        </div>
        {showKeyboardNavHint ? (
          <p className="mt-3 text-[0.78rem] text-neutral-500">
            Arrow keys move focus. Space or X selects. B stars the focused photo. Delete removes
            the selection. Esc clears selection. On touch devices, hold a tile to reveal actions.
          </p>
        ) : null}
      </div>

      {error ? <ErrorMessage message={error} /> : null}

      <div
        ref={gridRef}
        role="listbox"
        aria-label="Gallery photos"
        aria-multiselectable="true"
        className={`grid ${isListMode
          ? "gap-3 grid-cols-1"
          : isSmallGridMode
            ? "gap-3 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
            : "gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
          }`}
      >
        {photos.map((photo, index) => {
          const isBanner = gallery?.banner_photo_id === photo.id;
          const isSelected = selectedSet.has(photo.id);
          const isActive = activePhotoId === photo.id;
          const isCursorActive = keyboardMode && isActive;
          const isDeleting = deletingSet.has(photo.id);

          return (
            <PhotoTile
              key={photo.id}
              ref={(node) => {
                photoRefs.current[photo.id] = node;
              }}
              photo={photo}
              index={index}
              total={photos.length}
              isListMode={isListMode}
              isSmallGridMode={isSmallGridMode}
              isBanner={isBanner}
              isSelected={isSelected}
              isActive={isActive}
              isCursorActive={isCursorActive}
              isDeleting={isDeleting}
              settingBanner={settingBanner}
              showInfo={showInfo}
              isTouchDevice={isTouchDevice}
              isMultiSelectMode={selectedCount > 0}
              onFocus={() => {
                setActivePhotoId(photo.id);
                ensurePhotoVisible(photo.id);
              }}
              onActivate={() => setActivePhotoId(photo.id)}
              onKeyDown={(event) => handleTileKeyDown(event, photo.id)}
              onSetBanner={() => handleSetBanner(photo.id)}
              onToggleMark={() => {
                setActivePhotoId(photo.id);
                toggleSelection(photo.id);
              }}
              onLongPressMark={() => {
                setActivePhotoId(photo.id);
                toggleSelection(photo.id);
              }}
              onPreview={() => {
                window.open(`/api/images/${photo.r2_key}?variant=full`, "_blank", "noopener,noreferrer");
              }}
            />
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
