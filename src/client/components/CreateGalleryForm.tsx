import { useState, useEffect, useRef } from "react";
import { FieldError } from "@/client/components/ErrorMessage";
import { cardStyle, inputStyle, accentButtonStyle } from "@/client/components/ui";
import { PasswordField } from "@/client/components/PasswordField";
import { EmailListInput } from "@/client/components/EmailListInput";
import { useTenant } from "@/client/lib/tenantContext";

type Props = {
  onCreated: () => void;
  onCancel: () => void;
};

export function CreateGalleryForm({ onCreated, onCancel }: Props) {
  const { apiBase } = useTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Slug availability
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "reserved" | "invalid">("idle");
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function checkSlug(value: string) {
    if (!value) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/admin/galleries/check-slug?slug=${encodeURIComponent(value)}`, { credentials: "include" });
        const data = await res.json() as { valid: boolean; available: boolean; reserved: boolean };
        if (!data.valid) setSlugStatus("invalid");
        else if (data.reserved) setSlugStatus("reserved");
        else if (!data.available) setSlugStatus("taken");
        else setSlugStatus("available");
      } catch {
        setSlugStatus("idle");
      }
    }, 400);
  }

  function handleNameChange(v: string) {
    setName(v);
    const derived = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSlug(derived);
    checkSlug(derived);
  }

  function handleSlugChange(v: string) {
    setSlug(v);
    checkSlug(v);
  }

  function handleTogglePublic() {
    setIsPublic((v) => !v);
    if (!isPublic) setPassword(""); // clear password when switching to public
  }

  function handleAddEmailToList(email: string) {
    if (!email || emailList.includes(email)) return;
    setEmailList((prev) => [...prev, email]);
  }

  function handleRemoveFromList(email: string) {
    setEmailList((prev) => prev.filter((e) => e !== email));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries`, {
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
              fetch(`${apiBase}/admin/galleries/${data.gallery!.id}/allowed-emails`, {
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
        onChange={(e) => handleSlugChange(e.target.value)}
        required
        pattern="[-a-z0-9]+"
        style={{
          ...inputStyle,
          borderColor: slugStatus === "available" ? "var(--color-accent)"
            : slugStatus === "taken" || slugStatus === "reserved" || slugStatus === "invalid" ? "#e05c5c"
              : undefined,
        }}
      />
      {slugStatus === "checking" && <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: "-4px 0 0" }}>Checking…</p>}
      {slugStatus === "available" && <p style={{ fontSize: "0.78rem", color: "var(--color-accent)", margin: "-4px 0 0" }}>✓ Available</p>}
      {slugStatus === "taken" && <p style={{ fontSize: "0.78rem", color: "#e05c5c", margin: "-4px 0 0" }}>✗ Already in use</p>}
      {slugStatus === "reserved" && <p style={{ fontSize: "0.78rem", color: "#e05c5c", margin: "-4px 0 0" }}>✗ Reserved word</p>}
      {slugStatus === "invalid" && <p style={{ fontSize: "0.78rem", color: "#e05c5c", margin: "-4px 0 0" }}>✗ Only lowercase letters, numbers, dashes</p>}
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
      <EmailListInput
        emails={emailList}
        onAdd={handleAddEmailToList}
        onRemove={handleRemoveFromList}
        placeholder="viewer@example.com"
        label={
          <>
            Allowed email addresses{" "}
            <span style={{ fontStyle: "italic" }}>
              (optional — passwordless OTP access; invite emails are sent on creation)
            </span>
          </>
        }
      />
      {error && <FieldError message={error} />}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={creating || slugStatus === "taken" || slugStatus === "reserved" || slugStatus === "invalid"} style={accentButtonStyle}>
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
