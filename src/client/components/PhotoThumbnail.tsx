import type { CSSProperties } from "react";

type Props = {
  r2Key: string;
  alt: string;
  fit?: "cover" | "full-width";
  style?: CSSProperties;
  onClick?: () => void;
  index?: number;
  total?: number;
  marked?: boolean;
  showBannerBadge?: boolean;
  bannerActive?: boolean;
  onBannerClick?: () => void;
  filename?: string;
  size?: string;
  sharp?: boolean;
};

const badgeClass =
  "absolute text-[0.7rem] font-medium px-1.5 py-0.5 rounded bg-black/55 text-white";
const badgeFont: CSSProperties = { fontFamily: '"Courier New", Courier, monospace' };

export function PhotoThumbnail({
  r2Key,
  alt,
  fit = "cover",
  style,
  onClick,
  index,
  total,
  marked = false,
  showBannerBadge = false,
  bannerActive = false,
  onBannerClick,
  filename,
  size,
  sharp = false,
}: Props) {
  const url = `/api/images/${r2Key}?variant=thumb`;
  const wrapperBase =
    fit === "cover"
      ? `relative overflow-hidden ${sharp ? "rounded-none" : "rounded-md"} aspect-square bg-neutral-800`
      : `relative overflow-hidden ${sharp ? "rounded-none" : "rounded-md"} bg-neutral-800`;
  const imgClass =
    fit === "cover"
      ? "w-full h-full object-cover block"
      : "w-full h-auto block";

  return (
    <div
      className={`${wrapperBase} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      style={style}
    >
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={imgClass}
        onLoad={(e) => {
          const skeleton = e.currentTarget.nextSibling as HTMLElement | null;
          if (skeleton && skeleton.classList.contains("photo-skeleton")) {
            skeleton.style.display = "none";
          }
        }}
      />
      <div
        className="photo-skeleton absolute inset-0 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_100%]"
        style={{ animation: "shimmer 1.5s ease-in-out infinite" }}
      />
      {index !== undefined && total !== undefined && (
        <span className={`${badgeClass} pointer-events-none top-1.5 right-1.5 inline-flex items-center gap-1`} style={badgeFont}>
          <span>
            {index} / {total}
          </span>
          {marked ? (
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-white/90"
            />
          ) : null}
        </span>
      )}
      {showBannerBadge ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onBannerClick?.();
          }}
          aria-label={bannerActive ? "Remove banner photo" : "Set as banner photo"}
          title={bannerActive ? "Remove banner" : "Set as banner"}
          className={`${badgeClass} pointer-events-auto left-1.5 top-1.5 h-auto w-auto cursor-pointer border-0 p-0 ${bannerActive ? "bg-amber-400 text-neutral-950" : "hover:bg-black/70"}`}
          style={badgeFont}
        >
          <span>
            <span className="sr-only">{bannerActive ? "Banner photo" : "Set as banner"}</span>
            <span aria-hidden="true" className="inline-flex items-center">
              {bannerActive ? "★" : "☆"}
            </span>
          </span>
        </button>
      ) : null}
      {filename && (
        <span
          className={`${badgeClass} pointer-events-none bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate`}
          style={badgeFont}
        >
          {filename}
        </span>
      )}
      {size && (
        <span className={`${badgeClass} pointer-events-none bottom-1.5 right-1.5`} style={badgeFont}>
          {size}
        </span>
      )}
    </div>
  );
}

if (typeof document !== "undefined" && !document.getElementById("photo-thumbnail-shimmer")) {
  const style = document.createElement("style");
  style.id = "photo-thumbnail-shimmer";
  style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(style);
}