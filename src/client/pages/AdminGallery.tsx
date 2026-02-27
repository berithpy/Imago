import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { EmptyState } from "@/client/components/EmptyState";
import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { cardSmallStyle, accentButtonStyle, iconButtonStyle, ghostButtonStyle, dangerButtonStyle, formatSize } from "@/client/components/ui";
import { exportGallery } from "@/client/lib/exportGallery";
import { PasswordField } from "@/client/components/PasswordField";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

/** Convert unix timestamp to YYYY-MM-DD for <input type="date"> */
function toDateInputValue(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

/** Format a unix timestamp as a readable date */
function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

type Photo = {
  id: string;
  r2_key: string;
  original_name: string;
  size: number;
  uploaded_at: number;
};

type Gallery = {
  id: string;
  name: string;
  slug: string;
  is_public: number;
  banner_photo_id: string | null;
  banner_r2_key: string | null;
  event_date: number | null;
  expires_at: number | null;
  deleted_at: number | null;
};

export function AdminGallery() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingBanner, setSettingBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [settingsEventDate, setSettingsEventDate] = useState("");
  const [settingsExpiresAt, setSettingsExpiresAt] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetDone, setPasswordResetDone] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const [deletingGallery, setDeletingGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authClient.getSession({ fetchOptions: { credentials: "include" } }).then(({ data }) => {
      if (!data?.session) navigate("/admin/login");
      else loadPhotos();
    });
  }, [id]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/galleries/${id}/photos`, { credentials: "include" });
      if (res.status === 401) { navigate("/admin/login"); return; }
      if (res.status === 404) { navigate("/admin"); return; }
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { gallery: Gallery; photos: Photo[] };
      setGallery(data.gallery);
      setPhotos(data.photos ?? []);
      // Pre-fill settings form
      setSettingsName(data.gallery.name);
      setSettingsDescription("");
      setSettingsEventDate(data.gallery.event_date ? toDateInputValue(data.gallery.event_date) : "");
      setSettingsExpiresAt(data.gallery.expires_at ? toDateInputValue(data.gallery.expires_at) : "");
    } catch (err) {
      console.error("Failed to load photos", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Uploading ${i + 1} / ${files.length}: ${file.name}`);
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/admin/galleries/${id}/photos`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
    }

    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadPhotos();
  }

  async function handleDelete(photoId: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    setDeleting(photoId);
    await fetch(`/api/admin/galleries/${id}/photos/${photoId}`, {
      method: "DELETE",
      credentials: "include",
    });
    setDeleting(null);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    await fetch(`/api/admin/galleries/${id}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: settingsName || undefined,
        event_date: settingsEventDate ? Math.floor(new Date(settingsEventDate).getTime() / 1000) : null,
        expires_at: settingsExpiresAt ? Math.floor(new Date(settingsExpiresAt).getTime() / 1000) : null,
      }),
    });
    setGallery((g) => g ? {
      ...g,
      name: settingsName || g.name,
      event_date: settingsEventDate ? Math.floor(new Date(settingsEventDate).getTime() / 1000) : null,
      expires_at: settingsExpiresAt ? Math.floor(new Date(settingsExpiresAt).getTime() / 1000) : null,
    } : g);
    setSavingSettings(false);
    setShowSettings(false);
  }

  async function handleSetBanner(photoId: string) {
    if (!gallery) return;
    setSettingBanner(true);
    const isCurrent = gallery.banner_photo_id === photoId;
    const newBannerId = isCurrent ? null : photoId;
    const newBannerKey = isCurrent ? null : (photos.find((p) => p.id === photoId)?.r2_key ?? null);
    await fetch(`/api/admin/galleries/${id}/banner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ photoId: newBannerId }),
    });
    setGallery((g) => g ? { ...g, banner_photo_id: newBannerId, banner_r2_key: newBannerKey } : g);
    setSettingBanner(false);
  }

  async function handleTogglePublic() {
    if (!gallery) return;
    const next = !gallery.is_public;
    await fetch(`/api/admin/galleries/${id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_public: next }),
    });
    setGallery((g) => g ? { ...g, is_public: next ? 1 : 0 } : g);
  }

  async function handleResetPassword() {
    if (!newPassword) return;
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/admin/galleries/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error();
      setNewPassword("");
      setPasswordResetDone(true);
      setTimeout(() => setPasswordResetDone(false), 2500);
    } catch {
      alert("Failed to reset password.");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleSoftDelete() {
    if (!gallery) return;
    if (!confirm(`Hide "${gallery.name}" from viewers? You can restore it later.`)) return;
    setDeletingGallery(true);
    await fetch(`/api/admin/galleries/${id}`, { method: "DELETE", credentials: "include" });
    setGallery((g) => g ? { ...g, deleted_at: Math.floor(Date.now() / 1000) } : g);
    setDeletingGallery(false);
  }

  async function handleRestore() {
    if (!gallery) return;
    setDeletingGallery(true);
    await fetch(`/api/admin/galleries/${id}/restore`, { method: "POST", credentials: "include" });
    setGallery((g) => g ? { ...g, deleted_at: null } : g);
    setDeletingGallery(false);
  }

  async function handlePermanentDelete() {
    if (!gallery) return;
    if (!confirm(`Permanently delete "${gallery.name}" and ALL its photos? This cannot be undone.`)) return;
    setDeletingGallery(true);
    await fetch(`/api/admin/galleries/${id}/permanent`, { method: "DELETE", credentials: "include" });
    navigate("/admin");
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress("Preparing export…");
    try {
      const res = await fetch(`/api/admin/galleries/${id}/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json() as { galleryName: string; photos: { name: string; url: string }[] };
      await exportGallery(data.galleryName, data.photos, (done, total) => {
        setExportProgress(`Downloading ${done} / ${total}…`);
      });
    } catch (err) {
      console.error(err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
      setExportProgress(null);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Link to="/admin" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", textDecoration: "none" }}>
            ← Back to galleries
          </Link>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 6 }}>
            {gallery?.name ?? "Gallery"}
          </h1>
          {gallery && (
            <a
              href={`/gallery/${gallery.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}
            >
              /gallery/{gallery.slug} ↗
            </a>
          )}
          {gallery?.deleted_at && (
            <span style={{ display: "inline-block", marginTop: 4, fontSize: "0.75rem", padding: "2px 8px", borderRadius: 4, background: "var(--color-border)", color: "var(--color-text-muted)", fontWeight: 600, letterSpacing: "0.04em" }}>HIDDEN</span>
          )}
          {gallery?.event_date && (
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 4 }}>
              📅 {formatDate(gallery.event_date)}
            </div>
          )}
          {gallery?.expires_at && (
            <div style={{ fontSize: "0.8rem", color: gallery.expires_at * 1000 < Date.now() ? "var(--color-error)" : "var(--color-text-muted)", marginTop: 2 }}>
              ⏳ Expires {formatDate(gallery.expires_at)}
            </div>
          )}
        </div>

        {/* Visibility toggle + upload */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {gallery && (
            <button
              onClick={handleTogglePublic}
              title={gallery.is_public ? "Make private" : "Make public"}
              style={{
                padding: "7px 14px",
                background: gallery.is_public ? "var(--color-accent)" : "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: gallery.is_public ? "#0f0f0f" : "var(--color-text-muted)",
                fontSize: "0.85rem",
                fontWeight: gallery.is_public ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {gallery.is_public ? "🌐 Public" : "🔒 Private"}
            </button>
          )}
          {gallery && (
            gallery.deleted_at ? (
              <>
                <button
                  onClick={handleRestore}
                  disabled={deletingGallery}
                  style={{ ...ghostButtonStyle, fontSize: "0.85rem" }}
                >
                  Restore
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={deletingGallery}
                  style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}
                >
                  Delete forever
                </button>
              </>
            ) : (
              <button
                onClick={handleSoftDelete}
                disabled={deletingGallery}
                style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}
              >
                Hide gallery
              </button>
            )
          )}
          <button
            onClick={() => setShowSettings((v) => !v)}
            style={{
              padding: "7px 14px",
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              color: "var(--color-text-muted)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            ⚙ Settings
          </button>
          {photos.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: "7px 14px",
                background: exportDone ? "var(--color-accent)" : "none",
                border: `1px solid ${exportDone ? "var(--color-accent)" : "var(--color-border)"}`,
                borderRadius: "var(--radius)",
                color: exportDone ? "#0f0f0f" : exporting ? "var(--color-text-muted)" : "var(--color-text)",
                fontSize: "0.85rem",
                fontWeight: exportDone ? 600 : 400,
                cursor: exporting ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.2s, color 0.2s, border-color 0.2s",
              }}
            >
              {exportDone ? "✓ Saved!" : exporting ? exportProgress : "⬇ Export zip"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: "none" }}
            id="upload-input"
          />
          <label htmlFor="upload-input" style={{ ...accentButtonStyle, cursor: uploading ? "not-allowed" : "pointer", opacity: uploading ? 0.6 : 1 }}>
            {uploading ? uploadProgress : "+ Upload photos"}
          </label>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
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
                style={{ padding: "8px 12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", color: "var(--color-text)", fontSize: "0.9rem", outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Event / shoot date</label>
              <input
                type="date"
                value={settingsEventDate}
                onChange={(e) => setSettingsEventDate(e.target.value)}
                style={{ padding: "8px 12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", color: "var(--color-text)", fontSize: "0.9rem", outline: "none" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>Expiry date <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>(gallery hides automatically)</span></label>
              <input
                type="date"
                value={settingsExpiresAt}
                onChange={(e) => setSettingsExpiresAt(e.target.value)}
                style={{ padding: "8px 12px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", color: "var(--color-text)", fontSize: "0.9rem", outline: "none" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={savingSettings} style={{ padding: "8px 18px", background: "var(--color-accent)", border: "none", borderRadius: "var(--radius)", color: "#0f0f0f", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}>
              {savingSettings ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowSettings(false)} style={{ padding: "8px 18px", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius)", color: "var(--color-text-muted)", fontSize: "0.9rem", cursor: "pointer" }}>
              Cancel
            </button>
          </div>

          {/* Password reset — separate submit so it doesn't save other settings */}
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>Reset gallery password</label>
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              placeholder="New password"
              onAction={handleResetPassword}
              actionLoading={resettingPassword}
              actionDone={passwordResetDone}
              showGenerate={true}
            />
          </div>
        </form>
      )}

      {/* Photo grid */}
      {loading ? (
        <SpinnerOverlay label="Loading photos…" />
      ) : photos.length === 0 ? (
        <EmptyState
          message="No photos yet."
          action={
            <label htmlFor="upload-input" style={{ ...accentButtonStyle, cursor: "pointer" }}>
              Upload your first photo
            </label>
          }
        />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}>
          {photos.map((photo) => (
            <div key={photo.id} style={cardSmallStyle}>
              {/* Thumbnail + banner toggle */}
              <div style={{ position: "relative" }}>
                <PhotoThumbnail
                  r2Key={photo.r2_key}
                  alt={photo.original_name}
                  fit="cover"
                  style={{ marginBottom: 10 }}
                />
                <button
                  onClick={() => handleSetBanner(photo.id)}
                  disabled={settingBanner}
                  title={gallery?.banner_photo_id === photo.id ? "Remove banner" : "Set as banner"}
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    background: gallery?.banner_photo_id === photo.id ? "var(--color-accent)" : "rgba(0,0,0,0.55)",
                    border: "none",
                    borderRadius: 4,
                    color: gallery?.banner_photo_id === photo.id ? "#0f0f0f" : "white",
                    fontSize: "0.8rem",
                    padding: "2px 6px",
                    cursor: "pointer",
                    lineHeight: 1.6,
                  }}
                >
                  ★
                </button>
              </div>

              {/* Meta + actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--color-text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {photo.original_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    {formatSize(photo.size)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(photo.id, photo.original_name)}
                  disabled={deleting === photo.id}
                  style={{ ...iconButtonStyle, opacity: deleting === photo.id ? 0.5 : 1 }}
                  title="Delete photo"
                >
                  {deleting === photo.id ? "…" : "✕"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress overlay */}
      {uploading && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          padding: "14px 20px",
          fontSize: "0.9rem",
          color: "var(--color-accent)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          {uploadProgress}
        </div>
      )}
    </div>
  );
}




