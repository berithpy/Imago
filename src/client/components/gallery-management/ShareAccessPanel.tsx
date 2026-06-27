import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/client/components/Button";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import type { NewGalleryShareAccessState } from "@/client/lib/galleryManagement";
import { buildAbsoluteGalleryUrl, buildGalleryShareAccessCopy, copyToClipboard } from "@/client/lib/share";

type Props = NewGalleryShareAccessState & {
  routeBase: string;
  onConsumed: () => void;
};

export function ShareAccessPanel({
  galleryName,
  gallerySlug,
  password,
  routeBase,
  onConsumed,
}: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [showCopied, setShowCopied] = useState(false);
  const copiedFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessUrl = useMemo(() => buildAbsoluteGalleryUrl(routeBase, gallerySlug), [gallerySlug, routeBase]);
  const accessCopy = useMemo(
    () => buildGalleryShareAccessCopy({ galleryName, url: accessUrl, password }),
    [accessUrl, galleryName, password]
  );

  useEffect(() => {
    return () => {
      if (copiedFadeTimeoutRef.current) {
        clearTimeout(copiedFadeTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopyAccess() {
    setCopyState("copying");
    const copied = await copyToClipboard(accessCopy);
    if (!copied) {
      setCopyState("failed");
      setShowCopied(false);
      return;
    }

    setCopyState("copied");
    setShowCopied(true);
    if (copiedFadeTimeoutRef.current) {
      clearTimeout(copiedFadeTimeoutRef.current);
    }
    copiedFadeTimeoutRef.current = setTimeout(() => {
      setShowCopied(false);
    }, 2200);
  }

  return (
    <section className="mb-6 rounded-lg border border-amber-400/50 bg-amber-400/10 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-neutral-100">Share access now</h2>
            <span
              aria-live="polite"
              className={`text-xs text-amber-200 ${showCopied ? "opacity-100" : "opacity-0 transition-opacity duration-500"}`}
            >
              Copied
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-300">
            Hide dismisses this panel. It will appear again the next time you change the gallery password.
          </p>
        </div>
      </div>

      {copyState === "failed" ? (
        <ErrorMessage message="Clipboard copy failed. You can still copy the full message manually below." />
      ) : null}

      <div className="mt-4">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Message preview
          <textarea
            readOnly
            value={accessCopy}
            rows={4}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 leading-relaxed resize-none"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          analyticsId="gallery_share_access_hide"
          onClick={onConsumed}
          className="!bg-neutral-900 !border-neutral-700 !hover:bg-neutral-800 !text-neutral-200"
        >
          Hide
        </Button>
        <Button
          type="button"
          analyticsId="gallery_share_access_copy"
          loading={copyState === "copying"}
          onClick={handleCopyAccess}
        >
          {copyState === "copying" ? "Copying..." : "Copy details"}
        </Button>
      </div>
    </section>
  );
}
