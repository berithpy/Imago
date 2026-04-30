import { useEffect } from "react";
import { shareUrl } from "@/client/lib/share";

type Props = {
  r2Key: string;
  alt: string;
  filename: string;
  onClose: () => void;
};

export function Lightbox({ r2Key, alt, filename, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleShare() {
    await shareUrl(filename, window.location.href);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-3 right-3 flex gap-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); void handleShare(); }}
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm cursor-pointer"
        >
          Share
        </button>
        <a
          href={`/api/images/${r2Key}?variant=full`}
          download={filename}
          onClick={(e) => e.stopPropagation()}
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm"
        >
          Download
        </a>
        <button
          onClick={onClose}
          aria-label="Close"
          className="px-3 py-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-100 text-sm cursor-pointer"
        >
          Close
        </button>
      </div>

      <img
        src={`/api/images/${r2Key}?variant=full`}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}