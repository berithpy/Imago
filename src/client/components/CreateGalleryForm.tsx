import { useState } from "react";
import { FieldError } from "@/client/components/ErrorMessage";
import { cardStyle, inputStyle, accentButtonStyle } from "@/client/components/ui";
import { PasswordField } from "@/client/components/PasswordField";

type Props = {
  onCreated: () => void;
  onCancel: () => void;
};

export function CreateGalleryForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }

  function handleTogglePublic() {
    setIsPublic((v) => !v);
    if (!isPublic) setPassword(""); // clear password when switching to public
  }

  function handleAddEmailToList() {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || emailList.includes(trimmed)) { setEmailInput(""); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    setEmailList((prev) => [...prev, trimmed]);
    setEmailInput("");
  }

  function handleRemoveFromList(email: string) {
    setEmailList((prev) => prev.filter((e) => e !== email));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          slug,
          password: isPublic ? "" : password,
          description: description || undefined,
          is_public: isPublic,
          event_date: eventDate ? Math.floor(new Date(eventDate).getTime() / 1000) : null,
          expires_at: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null,
        }),
      });
      const data = await res.json() as { error?: string; gallery?: { id: string } };
      if (res.ok) {
        if (emailList.length > 0 && data.gallery?.id) {
          await Promise.all(
            emailList.map((email) =>
              fetch(`/api/admin/galleries/${data.gallery!.id}/allowed-emails`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email }),
              })
            )
          );
        }
        onCreated();
      } else {
        setError(data.error ?? "Failed to create gallery");
      }
    } finally {
      setCreating(false);
    }
  }

  const inputPanelStyle: React.CSSProperties = {
    padding: "8px 12px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius)",
    color: "var(--color-text)",
    fontSize: "0.9rem",
    outline: "none",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ ...cardStyle, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <h3 style={{ fontWeight: 600, marginBottom: 4 }}>New Gallery</h3>

      <input
        placeholder="Name"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        required
        style={inputStyle}
      />
      <input
        placeholder="Slug (URL)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        required
        pattern="[-a-z0-9]+"
        style={inputStyle}
      />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        autoComplete="off"
        style={inputStyle}
      />

      {/* Visibility toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={handleTogglePublic}
          style={{
            padding: "7px 14px",
            background: isPublic ? "var(--color-accent)" : "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: isPublic ? "#0f0f0f" : "var(--color-text-muted)",
            fontSize: "0.85rem",
            fontWeight: isPublic ? 600 : 400,
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {isPublic ? "🌐 Public" : "🔒 Private"}
        </button>
        <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          {isPublic ? "No password required" : "Viewers need a password"}
        </span>
      </div>

      {/* Password — only shown for private galleries */}
      {!isPublic && (
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Viewer password"
          required
          showGenerate
        />
      )}

      {/* Date fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Event date (optional)</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={inputPanelStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Expires at (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            style={inputPanelStyle}
          />
        </div>
      </div>

      {/* Email whitelist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          Allowed email addresses{" "}
          <span style={{ fontStyle: "italic" }}>(optional — passwordless OTP access; invite emails are sent on creation)</span>
        </label>
        {emailList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {emailList.map((email) => (
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
                }}
              >
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveFromList(email)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 0, lineHeight: 1, fontSize: "0.8rem" }}
                  title="Remove"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            placeholder="viewer@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmailToList(); } }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={handleAddEmailToList}
            disabled={!emailInput.trim()}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: "var(--color-text)",
              fontSize: "0.85rem",
              cursor: emailInput.trim() ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
            }}
          >
            Add
          </button>
        </div>
      </div>

      {error && <FieldError message={error} />}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={creating} style={accentButtonStyle}>
          {creating ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 18px",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text-muted)",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
