type IndexedPhoto = {
  id: string;
  r2_key: string;
};

export function getActivePhotoIndex(photos: IndexedPhoto[], activePhotoId?: string): number {
  if (!activePhotoId) return -1;
  return photos.findIndex((photo) => photo.id === activePhotoId);
}

export function getNavigationTargetIndex(currentIndex: number, total: number, offset: -1 | 1): number {
  if (currentIndex < 0 || total <= 0) return -1;
  const targetIndex = currentIndex + offset;
  if (targetIndex < 0 || targetIndex >= total) return -1;
  return targetIndex;
}

export function getAdjacentPreloadPhotos(photos: IndexedPhoto[], currentIndex: number): IndexedPhoto[] {
  if (currentIndex < 0 || currentIndex >= photos.length) return [];
  const indices = [currentIndex - 1, currentIndex + 1];
  return indices
    .filter((index) => index >= 0 && index < photos.length)
    .map((index) => photos[index]);
}
