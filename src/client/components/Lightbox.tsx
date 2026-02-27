import type { MouseEvent } from "react";

interface LightboxProps {
  r2Key: string;
  alt: string;
  onClose: () => void;
  filename?: string;
}

export function Lightbox({ r2Key, alt, onClose, filename }: LightboxProps) {
  async function handleDownload(e: MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/images/${r2Key}?variant=full`, { credentials: "include" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? r2Key.split("/").pop() ?? "photo";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
    >
      <img
        src={`/api/images/${r2Key}?variant=full`}
        alt={alt}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Close button — top right */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "fixed",
          top: 20,
          right: 24,
          background: "none",
          border: "none",
          color: "white",
          fontSize: "2rem",
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ×
      </button>
      {/* Download button — bottom center */}
      <button
        onClick={handleDownload}
        aria-label="Download photo"
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: 6,
          color: "white",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "0.85rem",
          padding: "6px 18px",
          cursor: "pointer",
          backdropFilter: "blur(4px)",
        }}
      >
        ⬇ Download
      </button>
    </div>
  );
}
