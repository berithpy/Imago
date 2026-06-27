import { useEffect, useState } from "react";
import { ConfirmationModal } from "@/client/components/ConfirmationModal";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { useTenant } from "@/client/lib/tenantContext";
import type { Gallery, NewGalleryShareAccessState } from "@/client/lib/galleryManagement";
import { toDateInputValue } from "@/client/lib/galleryManagement";
import { PasswordResetSection } from "@/client/components/gallery-management/PasswordResetSection";
import { VisibilityToggle } from "@/client/components/gallery-management/VisibilityToggle";
import { ShareAccessPanel } from "@/client/components/gallery-management/ShareAccessPanel";

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
  const { apiBase, routeBase } = useTenant();
  const [settingsName, setSettingsName] = useState("");
  const [settingsEventDate, setSettingsEventDate] = useState("");
  const [settingsExpiresAt, setSettingsExpiresAt] = useState("");
  const [sharePreviewEnabled, setSharePreviewEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [deletingGallery, setDeletingGallery] = useState(false);
  const [pendingPrivateCompletion, setPendingPrivateCompletion] = useState(false);
  const [pendingShareAccess, setPendingShareAccess] = useState<NewGalleryShareAccessState | null>(null);
  const [showShareAccessPanel, setShowShareAccessPanel] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  }>(null);

  useEffect(() => {
    setSettingsName(gallery.name);
    setSettingsEventDate(gallery.event_date ? toDateInputValue(gallery.event_date) : "");
    setSettingsExpiresAt(gallery.expires_at ? toDateInputValue(gallery.expires_at) : "");
    setSharePreviewEnabled(!!gallery.share_preview_enabled);
    if (!gallery.is_public) {
      setPendingPrivateCompletion(false);
    }
  }, [gallery]);

  useEffect(() => {
    setPendingShareAccess(null);
    setShowShareAccessPanel(false);
  }, [gallery.id]);

  async function updateVisibility(next: boolean) {
    setSettingsError(null);
    setTogglingVisibility(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_public: next }),
      });
      if (!res.ok) throw new Error();
      onGalleryUpdated((current) => ({ ...current, is_public: next ? 1 : 0 }));
      if (!next) setPendingPrivateCompletion(false);
    } catch {
      setSettingsError(next ? "Failed to make the gallery public." : "Failed to make the gallery private.");
    } finally {
      setTogglingVisibility(false);
    }
  }

  function handleToggleVisibility() {
    if (gallery.is_public) {
      setPendingPrivateCompletion(true);
      setSettingsError(null);
      return;
    }

    setConfirmation({
      title: "Make this gallery public?",
      description: "Anyone with the link will be able to view it immediately.",
      confirmLabel: "Make public",
      action: async () => updateVisibility(true),
    });
  }

  async function handleSoftDelete() {
    setSettingsError(null);
    setDeletingGallery(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onGalleryUpdated((current) => ({ ...current, deleted_at: Math.floor(Date.now() / 1000) }));
    } catch {
      setSettingsError("Failed to hide the gallery.");
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleRestore() {
    setSettingsError(null);
    setDeletingGallery(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onGalleryUpdated((current) => ({ ...current, deleted_at: null }));
    } catch {
      setSettingsError("Failed to restore the gallery.");
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handlePermanentDelete() {
    setSettingsError(null);
    setDeletingGallery(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      onPermanentDeleteSuccess();
    } catch {
      setSettingsError("Failed to permanently delete the gallery.");
    } finally {
      setDeletingGallery(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError(null);
    setSavingSettings(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/settings`, {
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
      if (!res.ok) throw new Error();
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
    } catch {
      setSettingsError("Failed to save gallery settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleConfirmation() {
    if (!confirmation) return;
    setConfirming(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <form
      onSubmit={handleSaveSettings}
      className="mb-8 px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col gap-3.5"
    >
      <h3 className="font-semibold text-base mb-1">Gallery Settings</h3>
      {settingsError ? <ErrorMessage message={settingsError} /> : null}

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
        note={
          pendingPrivateCompletion
            ? "Finish the password step below to make this gallery private."
            : undefined
        }
      />
      <PasswordResetSection
        galleryId={galleryId}
        pendingPrivateCompletion={pendingPrivateCompletion}
        onPrivateCompletion={() => updateVisibility(false)}
        onCancelPrivateCompletion={() => setPendingPrivateCompletion(false)}
        onPasswordSaved={(password) => {
          setPendingShareAccess({
            galleryName: gallery.name,
            gallerySlug: gallery.slug,
            password,
          });
          setShowShareAccessPanel(true);
        }}
      />

      {showShareAccessPanel && pendingShareAccess ? (
        <ShareAccessPanel
          {...pendingShareAccess}
          routeBase={routeBase}
          onConsumed={() => {
            setPendingShareAccess(null);
            setShowShareAccessPanel(false);
          }}
        />
      ) : null}

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
                onClick={() =>
                  setConfirmation({
                    title: `Delete "${gallery.name}" forever?`,
                    description: "This permanently removes the gallery and all of its photos.",
                    confirmLabel: "Delete forever",
                    action: handlePermanentDelete,
                  })
                }
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
              onClick={() =>
                setConfirmation({
                  title: `Hide "${gallery.name}" from viewers?`,
                  description: "You can restore it later from the hidden galleries list.",
                  confirmLabel: "Hide gallery",
                  action: handleSoftDelete,
                })
              }
              disabled={deletingGallery}
              className={dangerBtnClass}
            >
              <span aria-hidden="true">🗑️</span> Hide gallery
            </button>
          </div>
        )}
      </div>
      <ConfirmationModal
        open={!!confirmation}
        title={confirmation?.title ?? ""}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "Confirm"}
        loading={confirming}
        onCancel={() => {
          if (!confirming) setConfirmation(null);
        }}
        onConfirm={handleConfirmation}
      />
    </form>
  );
}
