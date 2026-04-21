import { useEffect, useState } from "react";
import type { Gallery } from "@/client/lib/galleryManagement";
import { toDateInputValue } from "@/client/lib/galleryManagement";
import { GalleryManagementPasswordResetSection } from "@/client/components/gallery-management/GalleryManagementPasswordResetSection";
import { useTenant } from "@/client/lib/tenantContext";

type Props = {
  galleryId: string;
  gallery: Gallery;
  onClose: () => void;
  onGalleryUpdated: (updater: (current: Gallery) => Gallery) => void;
};

export function GalleryManagementSettingsPanel({
  galleryId,
  gallery,
  onClose,
  onGalleryUpdated,
}: Props) {
  const [settingsName, setSettingsName] = useState("");
  const [settingsEventDate, setSettingsEventDate] = useState("");
  const [settingsExpiresAt, setSettingsExpiresAt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const { apiBase } = useTenant();

  useEffect(() => {
    setSettingsName(gallery.name);
    setSettingsEventDate(gallery.event_date ? toDateInputValue(gallery.event_date) : "");
    setSettingsExpiresAt(gallery.expires_at ? toDateInputValue(gallery.expires_at) : "");
  }, [gallery]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: settingsName || undefined,
          event_date: settingsEventDate
            ? Math.floor(new Date(settingsEventDate).getTime() / 1000)
            : null,
          expires_at: settingsExpiresAt
            ? Math.floor(new Date(settingsExpiresAt).getTime() / 1000)
            : null,
        }),
      });

      onGalleryUpdated((current) => ({
        ...current,
        name: settingsName || current.name,
        event_date: settingsEventDate
          ? Math.floor(new Date(settingsEventDate).getTime() / 1000)
          : null,
        expires_at: settingsExpiresAt
          ? Math.floor(new Date(settingsExpiresAt).getTime() / 1000)
          : null,
      }));
      onClose();
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <form
      onSubmit={handleSaveSettings}
      style={{
        marginBottom: 32,
        padding: "20px 24px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <h3 style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 4 }}>Gallery Settings</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Gallery name</label>
          <input
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
            required
            style={{
              padding: "8px 12px",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: "var(--color-text)",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            Event / shoot date
          </label>
          <input
            type="date"
            value={settingsEventDate}
            onChange={(e) => setSettingsEventDate(e.target.value)}
            style={{
              padding: "8px 12px",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: "var(--color-text)",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
            Expiry date{" "}
            <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
              (gallery hides automatically)
            </span>
          </label>
          <input
            type="date"
            value={settingsExpiresAt}
            onChange={(e) => setSettingsExpiresAt(e.target.value)}
            style={{
              padding: "8px 12px",
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: "var(--color-text)",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={savingSettings}
          style={{
            padding: "8px 18px",
            background: "var(--color-accent)",
            border: "none",
            borderRadius: "var(--radius)",
            color: "#0f0f0f",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {savingSettings ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
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

      <GalleryManagementPasswordResetSection galleryId={galleryId} />
    </form>
  );
}
