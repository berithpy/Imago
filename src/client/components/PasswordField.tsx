import { generatePassword } from "@/client/lib/generatePassword";

const baseInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "8px 12px",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text)",
  fontSize: "0.9rem",
  outline: "none",
};

const baseButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text-muted)",
  fontSize: "0.85rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Mark the input as required within a parent <form> */
  required?: boolean;
  /** Show the 🎲 Generate button (useful on create) */
  showGenerate?: boolean;
  /** When provided, renders a standalone action button next to the input */
  onAction?: () => void;
  actionLabel?: string;
  actionLoadingLabel?: string;
  actionDoneLabel?: string;
  actionLoading?: boolean;
  actionDone?: boolean;
};

export function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  required,
  showGenerate,
  onAction,
  actionLabel = "Set password",
  actionLoadingLabel = "Saving…",
  actionDoneLabel = "✓ Updated!",
  actionLoading,
  actionDone,
}: Props) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="new-password"
        style={baseInputStyle}
      />

      {showGenerate && (
        <button
          type="button"
          onClick={() => onChange(generatePassword())}
          title="Generate a random password"
          style={baseButtonStyle}
        >
          🎲 Generate
        </button>
      )}

      {onAction && (
        <button
          type="button"
          onClick={() => onAction()}
          disabled={actionLoading || !value}
          style={{
            ...baseButtonStyle,
            padding: "8px 16px",
            background: actionDone ? "var(--color-accent)" : "none",
            border: `1px solid ${actionDone ? "var(--color-accent)" : "var(--color-border)"}`,
            color: actionDone ? "#0f0f0f" : "var(--color-text-muted)",
            fontWeight: actionDone ? 600 : 400,
            cursor: actionLoading || !value ? "not-allowed" : "pointer",
            transition: "background 0.2s, color 0.2s, border-color 0.2s",
          }}
        >
          {actionDone ? actionDoneLabel : actionLoading ? actionLoadingLabel : actionLabel}
        </button>
      )}
    </div>
  );
}
