import { useEffect } from "react";
import { shareUrl } from "@/client/lib/share";
import { Button, LinkButton } from "@/client/components/Button";

type Props = {
  r2Key: string;
  alt: string;
  filename: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  currentPosition: number;
  totalCount: number;
};

export function Lightbox({
  r2Key,
  alt,
  filename,
  onClose,
  onPrev,
  onNext,
  canPrev,
  canNext,
  currentPosition,
  totalCount,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canPrev) onPrev();
      if (e.key === "ArrowRight" && canNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrev, onNext, canPrev, canNext]);

  async function handleShare() {
    await shareUrl(filename, window.location.href);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col pt-12 pb-16"
      onClick={onClose}
    >
      {/* Top bar: counter + close button */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-4 py-2.5 h-12">
        {/* Counter - centered with monospace font */}
        <div className="flex-1 text-center px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm font-mono">
          {currentPosition} / {totalCount}
        </div>
        {/* Close button */}
        <Button
          onClick={onClose}
          aria-label="Close lightbox"
          variant="secondary"
          size="sm"
          analyticsId="lightbox_close"
          className="ml-2 px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm cursor-pointer"
        >
          Close
        </Button>
      </div>

      {/* Image viewport - centered and inset */}
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        <img
          src={`/api/images/${r2Key}?variant=full`}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Bottom bar: share and download buttons */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center gap-2 px-4 py-2.5 h-16">
        <Button
          onClick={(e) => { e.stopPropagation(); void handleShare(); }}
          variant="secondary"
          size="sm"
          analyticsId="lightbox_share"
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm cursor-pointer"
        >
          Share
        </Button>
        <LinkButton
          href={`/api/images/${r2Key}?variant=full`}
          download={filename}
          onClick={(e) => e.stopPropagation()}
          variant="secondary"
          size="sm"
          analyticsId="lightbox_download"
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm"
        >
          Download
        </LinkButton>
      </div>

      {/* Navigation arrows: unchanged, left/right positioning */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canPrev) onPrev();
        }}
        aria-label="Previous photo"
        disabled={!canPrev}
        className="absolute left-5 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer z-10"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canNext) onNext();
        }}
        aria-label="Next photo"
        disabled={!canNext}
        className="absolute right-5 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-100 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer z-10"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}