import { CSSProperties } from "react";

interface SpinnerProps {
  size?: number;
  style?: CSSProperties;
}

export function Spinner({ size = 28, style }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid var(--color-border)`,
        borderTopColor: "var(--color-accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        ...style,
      }}
    />
  );
}

// Centred full-area variant
export function SpinnerOverlay({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "80px 24px",
        color: "var(--color-text-muted)",
        fontSize: "0.9rem",
      }}
    >
      <Spinner />
      {label}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
