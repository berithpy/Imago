interface ErrorMessageProps {
  message: string;
  /** Optional retry callback — renders a "Try again" button */
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "48px 24px",
        color: "var(--color-error)",
        fontSize: "0.9rem",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: "1.5rem" }}>⚠</span>
      {message}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: "7px 18px",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text-muted)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline single-line error for forms */
export function FieldError({ message }: { message: string }) {
  return (
    <p style={{ color: "var(--color-error)", fontSize: "0.875rem", margin: 0 }}>
      {message}
    </p>
  );
}
