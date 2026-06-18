import { useEffect, useState } from "react";
import { useTenant } from "@/client/lib/tenantContext";
import type { Gallery } from "@/client/lib/galleryManagement";
import { toDateInputValue } from "@/client/lib/galleryManagement";
import { PasswordResetSection } from "@/client/components/gallery-management/PasswordResetSection";
import { VisibilityToggle } from "@/client/components/gallery-management/VisibilityToggle";

type Props = {
  galleryId: string;
  gallery: Gallery;
  onClose: () => void;
  onGalleryUpdated: (updater: (current: Gallery) => Gallery) => void;
  onPermanentDeleteSuccess: () => void;
};

const inputClass =
  "px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";
const ghostBtnClass =
  "px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer disabled:opacity-50";
const dangerBtnClass =
  "inline-flex items-center gap-1.5 px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-red-400 text-sm cursor-pointer disabled:opacity-50";

export function SettingsPanel({
  galleryId,
  gallery,
  onClose,
  onGalleryUpdated,
  onPermanentDeleteSuccess,
}: Props) {
  const { apiBase } = useTenant();
  const [settingsName, setSettingsName] = useState("");
  const [settingsEventDate, setSettingsEventDate] = useState("");
  const [settingsExpiresAt, setSettingsExpiresAt] = useState("");
  const [sharePreviewEnabled, setSharePreviewEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [deletingGallery, setDeletingGallery] = useState(false);

  useEffect(() => {
    setSettingsName(gallery.name);
    setSettingsEventDate(gallery.event_date ? toDateInputValue(gallery.event_date) : "");
    setSettingsExpiresAt(gallery.expires_at ? toDateInputValue(gallery.expires_at) : "");
    setSharePreviewEnabled(!!gallery.share_preview_enabled);
  }, [gallery]);

  async function handleToggleVisibility() {
    const next = !gallery.is_public;
    setTogglingVisibility(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_public: next }),
      });
      onGalleryUpdated((current) => ({ ...current, is_public: next ? 1 : 0 }));
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function handleSoftDelete() {
    if (!confirm(`Hide "${gallery.name}" from viewers? You can restore it later.`)) return;
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}`, { method: "DELETE", credentials: "include" });
      onGalleryUpdated((current) => ({ ...current, deleted_at: Math.floor(Date.now() / 1000) }));
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleRestore() {
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/restore`, { method: "POST", credentials: "include" });
      onGalleryUpdated((current) => ({ ...current, deleted_at: null }));
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handlePermanentDelete() {
    if (!confirm(`Permanently delete "${gallery.name}" and ALL its photos? This cannot be undone.`)) return;
    setDeletingGallery(true);
    try {
      await fetch(`${apiBase}/admin/galleries/${galleryId}/permanent`, { method: "DELETE", credentials: "include" });
      onPermanentDeleteSuccess();
    } finally {
      setDeletingGallery(false);
    }
  }

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
          share_preview_enabled: sharePreviewEnabled,
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
        share_preview_enabled: sharePreviewEnabled ? 1 : 0,
      }));
      onClose();
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <form
      onSubmit={handleSaveSettings}
      className="mb-8 px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col gap-3.5"
    >
      <h3 className="font-semibold text-base mb-1">Gallery Settings</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-neutral-500">Gallery name</label>
          <input
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-neutral-500">Event / shoot date</label>
          <input
            type="date"
            value={settingsEventDate}
            onChange={(e) => setSettingsEventDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-neutral-500">
            Expiry date <span className="italic text-neutral-500">(gallery hides automatically)</span>
          </label>
          <input
            type="date"
            value={settingsExpiresAt}
            onChange={(e) => setSettingsExpiresAt(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-start gap-2.5 px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg cursor-pointer">
        <input
          type="checkbox"
          checked={sharePreviewEnabled}
          onChange={(e) => setSharePreviewEnabled(e.target.checked)}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm text-neutral-100">Show preview when this link is shared</span>
          <span className="text-[0.78rem] text-neutral-500">
            Lets WhatsApp, Discord, iMessage, etc. show the gallery title and a banner
            thumbnail when someone pastes the link. The thumbnail becomes publicly viewable
            even for private galleries.
          </span>
        </span>
      </label>

      <div className="flex gap-2.5">
        <button
          type="submit"
          disabled={savingSettings}
          className="px-4 py-2 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm cursor-pointer disabled:opacity-60"
        >
          {savingSettings ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer"
        >
          Cancel
        </button>
      </div>
      <hr className="border-neutral-800" />
      <VisibilityToggle
        isPublic={!!gallery.is_public}
        loading={togglingVisibility}
        disabled={togglingVisibility}
        onChange={handleToggleVisibility}
      />
      <PasswordResetSection galleryId={galleryId} />

      <hr className="border-neutral-800" />
      <div>
        <h4 className=" mt-1 text-sm font-semibold text-red-400 mb-1">Danger zone</h4>
        {gallery.deleted_at ? (
          <>
            <p className="text-[0.78rem] text-neutral-500 mb-2.5">
              This gallery is hidden from viewers. Restore it or delete it permanently.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleRestore}
                disabled={deletingGallery}
                className={ghostBtnClass}
              >
                Restore
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={deletingGallery}
                className={dangerBtnClass}
              >
                <span aria-hidden="true">🗑️</span> Delete forever
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-row gap-2.5 justify-between">
            <span>

              <p className="text-[0.78rem] text-neutral-100">
                Hide this gallery from viewers.
              </p>
              <p className="text-[0.78rem] text-neutral-500">
                You can restore it later.
              </p>
            </span>
            <button
              type="button"
              onClick={handleSoftDelete}
              disabled={deletingGallery}
              className={dangerBtnClass}
            >
              <span aria-hidden="true">🗑️</span> Hide gallery
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
