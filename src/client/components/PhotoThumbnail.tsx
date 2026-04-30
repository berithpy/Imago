import type { CSSProperties } from "react";

type Props = {
  r2Key: string;
  alt: string;
  fit?: "cover" | "full-width";
  style?: CSSProperties;
  onClick?: () => void;
  index?: number;
  total?: number;
  filename?: string;
};

const badgeClass =
  "absolute text-[0.7rem] font-medium px-1.5 py-0.5 rounded bg-black/55 text-white pointer-events-none";

export function PhotoThumbnail({
  r2Key,
  alt,
  fit = "cover",
  style,
  onClick,
  index,
  total,
  filename,
}: Props) {
  const url = `/api/images/${r2Key}?variant=thumb`;
  const wrapperBase =
    fit === "cover"
      ? "relative overflow-hidden rounded-md aspect-square bg-neutral-800"
      : "relative overflow-hidden rounded-md bg-neutral-800";
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
        <span className={`${badgeClass} top-1.5 left-1.5`}>
          {index} / {total}
        </span>
      )}
      {filename && (
        <span className={`${badgeClass} bottom-1.5 left-1.5 right-1.5 truncate text-left`}>
          {filename}
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