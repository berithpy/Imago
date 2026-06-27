export type GalleryManagementViewMode = "list" | "grid" | "small-grid";

export function isMobileGalleryViewport(width: number): boolean {
  return width < 768;
}

export function getAvailableGalleryViewModes(width: number): GalleryManagementViewMode[] {
  return isMobileGalleryViewport(width)
    ? ["list", "small-grid"]
    : ["grid", "small-grid"];
}

export function getDefaultGalleryViewMode(width: number): GalleryManagementViewMode {
  return isMobileGalleryViewport(width) ? "list" : "grid";
}

export function getSafeGalleryViewMode(
  mode: GalleryManagementViewMode,
  width: number,
): GalleryManagementViewMode {
  const available = getAvailableGalleryViewModes(width);
  return available.includes(mode) ? mode : getDefaultGalleryViewMode(width);
}

export function shouldShowKeyboardHint(width: number): boolean {
  return !isMobileGalleryViewport(width);
}
