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
        flexDirection: "column",
        zIndex: 1000,
      }}
    >
      {/* Toolbar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(6px)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleDownload}
          aria-label="Download photo"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 6,
            color: "white",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "0.85rem",
            padding: "6px 18px",
            cursor: "pointer",
          }}
        >
          ⬇ Download
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            color: "white",
            fontSize: "1.5rem",
            lineHeight: 1,
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          ✕
        </button>
      </div>
      {/* Image area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          overflow: "hidden",
        }}
      >
        <img
          src={`/api/images/${r2Key}?variant=full`}
          alt={alt}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
