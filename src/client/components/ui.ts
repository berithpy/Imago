import { CSSProperties } from "react";

export const cardStyle: CSSProperties = {
  padding: "16px 20px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
};

export const cardSmallStyle: CSSProperties = {
  padding: 12,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text)",
  fontSize: "0.9rem",
  outline: "none",
};

export const inputLargeStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text)",
  fontSize: "1rem",
  outline: "none",
};

export const accentButtonStyle: CSSProperties = {
  display: "inline-block",
  padding: "8px 18px",
  background: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius)",
  color: "#0f0f0f",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
};

export const ghostButtonStyle: CSSProperties = {
  padding: "7px 14px",
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text-muted)",
  fontSize: "0.9rem",
  cursor: "pointer",
};

export const dangerButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  color: "var(--color-error)",
};

export const fullWidthButtonStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius)",
  color: "#0f0f0f",
  fontWeight: 600,
  fontSize: "1rem",
  cursor: "pointer",
};

export const iconButtonStyle: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-error, #e05252)",
  fontSize: "0.75rem",
  cursor: "pointer",
  padding: 0,
};

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
