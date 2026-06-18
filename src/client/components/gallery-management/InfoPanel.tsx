import { formatSize } from "@/client/lib/galleryManagement";

type Props = {
  photoCount: number;
  totalBytes: number;
};

export function InfoPanel({ photoCount, totalBytes }: Props) {
  const photoLabel = photoCount === 1 ? "photo" : "photos";

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-400">
      <span>
        <span className="text-neutral-100 font-semibold">{photoCount}</span> {photoLabel}
      </span>
      {photoCount > 0 && (
        <>
          <span className="text-neutral-700">·</span>
          <span>
            <span className="text-neutral-100 font-semibold">{formatSize(totalBytes)}</span>
          </span>
        </>
      )}
    </div>
  );
}
