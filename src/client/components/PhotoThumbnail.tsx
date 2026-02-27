import { CSSProperties, useState } from "react";

interface PhotoThumbnailProps {
  r2Key: string;
  alt: string;
  /** "cover" for fixed-ratio admin grid, "full-width" for masonry viewer */
  fit?: "cover" | "full-width";
  /** Aspect ratio when fit="cover", e.g. "4/3". Defaults to "4/3". */
  aspectRatio?: string;
  onClick?: () => void;
  style?: CSSProperties;
  /** 1-based index of this photo in the set */
  index?: number;
  /** Total photos in the set */
  total?: number;
  /** Original filename to display */
  filename?: string;
}

export function PhotoThumbnail({
  r2Key,
  alt,
  fit = "full-width",
  aspectRatio = "4/3",
  onClick,
  style,
  index,
  total,
  filename,
}: PhotoThumbnailProps) {
  const [loaded, setLoaded] = useState(false);

  if (fit === "cover") {
    return (
      <div
        style={{
          position: "relative",
          aspectRatio,
          overflow: "hidden",
          borderRadius: "calc(var(--radius) - 2px)",
          background: "var(--color-bg)",
          cursor: onClick ? "pointer" : undefined,
          ...style,
        }}
        onClick={onClick}
      >
        {/* Skeleton shimmer until image loads */}
        {!loaded && <div style={skeletonStyle} />}
        <img
          src={`/api/images/${r2Key}?variant=thumb`}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      </div>
    );
  }

  // full-width masonry tile
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--radius)",
        background: "var(--color-surface)",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      onClick={onClick}
    >
      {!loaded && (
        <div style={{ ...skeletonStyle, aspectRatio: "3/2", position: "relative" }} />
      )}
      <img
        src={`/api/images/${r2Key}?variant=thumb`}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />
      {loaded && filename && (
        <span style={{ ...badgeStyle, bottom: 8, left: 8, maxWidth: "calc(100% - 16px)", overflow: "hidden", textOverflow: "ellipsis" }}>
          {filename}
        </span>
      )}
      {loaded && index != null && total != null && (
        <span style={{ ...badgeStyle, top: 8, right: 8 }}>
          {index}&nbsp;/&nbsp;{total}
        </span>
      )}
    </div>
  );
}

const badgeStyle: CSSProperties = {
  position: "absolute",
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: 11,
  lineHeight: 1.4,
  padding: "2px 6px",
  borderRadius: 3,
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
  zIndex: 2,
};

const skeletonStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(90deg, var(--color-surface) 25%, var(--color-border) 50%, var(--color-surface) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
};

// Inject keyframes once
const styleTag = document.createElement("style");
styleTag.textContent = `@keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }`;
document.head.appendChild(styleTag);
