import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { FieldError } from "@/client/components/ErrorMessage";
import { inputLargeStyle, fullWidthButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

export function GalleryLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [bypassing, setBypassing] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if the visitor is a logged-in admin, and grab the gallery id
  useEffect(() => {
    // Fetch gallery metadata to get the gallery id
    fetch(`/api/galleries/${slug}`)
      .then((r) => r.ok ? r.json() as Promise<{ gallery?: { id: string; is_public: number } }> : null)
      .then((d) => {
        if (d?.gallery?.id) setGalleryId(d.gallery.id);
        // If the gallery is public, GalleryView handles auth — nothing to do here
        setChecking(false);
      })
      .catch(() => { setChecking(false); });

    authClient.getSession({ fetchOptions: { credentials: "include" } })
      .then(({ data }) => { if (data?.session) setIsAdmin(true); })
      .catch(() => { });
  }, [slug]);

  async function handleAdminBypass() {
    if (!galleryId) return;
    setBypassing(true);
    try {
      const res = await fetch(`/api/admin/galleries/${galleryId}/viewer-bypass`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        navigate(`/gallery/${slug}`);
      } else {
        setError("Admin bypass failed. Are you still logged in?");
      }
    } catch {
      setError("Connection error.");
    } finally {
      setBypassing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/viewer/gallery/${slug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        navigate(`/gallery/${slug}`);
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Incorrect password");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
          Enter Password
        </h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 32, fontSize: "0.9rem" }}>
          This gallery is password protected.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoFocus
            style={inputLargeStyle}
          />

          {error && <FieldError message={error} />}

          <button type="submit" disabled={loading} style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Checking…" : "View Gallery"}
          </button>
        </form>

        {isAdmin && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
            <button
              onClick={handleAdminBypass}
              disabled={bypassing || !galleryId}
              style={{
                ...fullWidthButtonStyle,
                opacity: bypassing || !galleryId ? 0.7 : 1,
                background: "none",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}
            >
              {bypassing ? "Bypassing…" : "🔑 Enter as admin (skip password)"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <a href="/" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            ← Back to galleries
          </a>
        </div>
      </div>
    </div>
  );
}


