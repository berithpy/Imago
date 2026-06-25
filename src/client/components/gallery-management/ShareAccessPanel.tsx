import { useMemo, useState } from "react";
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
  const accessUrl = useMemo(() => buildAbsoluteGalleryUrl(routeBase, gallerySlug), [gallerySlug, routeBase]);
  const accessCopy = useMemo(
    () => buildGalleryShareAccessCopy({ galleryName, url: accessUrl, password }),
    [accessUrl, galleryName, password]
  );

  async function handleCopyAccess() {
    setCopyState("copying");
    const copied = await copyToClipboard(accessCopy);
    if (!copied) {
      setCopyState("failed");
      return;
    }

    setCopyState("copied");
    setTimeout(() => {
      onConsumed();
    }, 900);
  }

  return (
    <section className="mb-6 rounded-lg border border-amber-400/50 bg-amber-400/10 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">Share access now</h2>
          <p className="mt-1 text-sm text-neutral-300">
            This password is only kept in this tab until you copy it or refresh the page.
          </p>
        </div>
        <Button
          type="button"
          analyticsId="gallery_share_access_copy"
          loading={copyState === "copying"}
          onClick={handleCopyAccess}
        >
          {copyState === "copying"
            ? "Copying..."
            : copyState === "copied"
              ? "Copied"
              : "Copy access details"}
        </Button>
      </div>

      {copyState === "failed" ? (
        <ErrorMessage message="Clipboard copy failed. You can still copy the link and password manually below." />
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Gallery link
          <input
            readOnly
            value={accessUrl}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Viewer password
          <input
            readOnly
            value={password}
            className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          />
        </label>
      </div>
    </section>
  );
}
