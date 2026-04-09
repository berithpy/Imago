import { useState } from "react";
import { inputStyle } from "@/client/components/ui";

type Props = {
  emails: string[];
  onAdd: (email: string) => void;
  onRemove: (email: string) => void;
  /** Show a spinner/disabled state on the Add button while an async add is in flight */
  adding?: boolean;
  /** Email currently being removed — shows inline loading indicator on that chip */
  removingEmail?: string | null;
  placeholder?: string;
  addButtonLabel?: string;
  label?: React.ReactNode;
};

export function EmailListInput({
  emails,
  onAdd,
  onRemove,
  adding = false,
  removingEmail = null,
  placeholder = "viewer@example.com",
  addButtonLabel = "Add",
  label,
}: Props) {
  const [input, setInput] = useState("");

  function commit() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          {label}
        </label>
      )}
      {emails.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {emails.map((email) => (
            <span
              key={email}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                fontSize: "0.8rem",
                opacity: removingEmail === email ? 0.5 : 1,
              }}
            >
              {email}
              <button
                type="button"
                onClick={() => onRemove(email)}
                disabled={removingEmail === email}
                style={{
                  background: "none",
                  border: "none",
                  cursor: removingEmail === email ? "not-allowed" : "pointer",
                  color: "var(--color-text-muted)",
                  padding: 0,
                  lineHeight: 1,
                  fontSize: "0.8rem",
                }}
                title="Remove"
              >
                {removingEmail === email ? "…" : "✕"}
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          disabled={adding}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={commit}
          disabled={adding || !input.trim()}
          style={{
            padding: "8px 14px",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text)",
            fontSize: "0.85rem",
            cursor: adding || !input.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {adding ? "Adding…" : addButtonLabel}
        </button>
      </div>
    </div>
  );
}
