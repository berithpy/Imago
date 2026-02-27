import { ReactNode } from "react";

interface EmptyStateProps {
  message?: string;
  /** Optional action element (e.g. a button or label) */
  action?: ReactNode;
}

export function EmptyState({ message = "Nothing here yet.", action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "80px 24px",
        color: "var(--color-text-muted)",
        fontSize: "1rem",
        textAlign: "center",
      }}
    >
      {message}
      {action}
    </div>
  );
}
