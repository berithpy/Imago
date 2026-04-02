import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { FieldError } from "@/client/components/ErrorMessage";
import { inputLargeStyle, fullWidthButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

type Mode = "email" | "sent" | "password";

export function GalleryLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [galleryName, setGalleryName] = useState<string | null>(null);
  const [bypassing, setBypassing] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch(`/api/galleries/${slug}`)
      .then((r) => r.ok ? r.json() as Promise<{ gallery?: { id: string; name: string; is_public: number } }> : null)
      .then((d) => {
        if (d?.gallery?.id) setGalleryId(d.gallery.id);
        if (d?.gallery?.name) setGalleryName(d.gallery.name);
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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/viewer/gallery/${slug}/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMode("sent");
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error === "Email not on access list"
          ? "This email doesn't have access to this gallery."
          : (data.error ?? "Failed to send link"));
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
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

  const title = galleryName ?? "this gallery";

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

        {/* ── Magic link sent ── */}
        {mode === "sent" && (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "var(--color-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem", marginBottom: 20,
            }}>✉</div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>Check your inbox</h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: "0.9rem", lineHeight: 1.6 }}>
              A sign-in link was sent to <strong>{email}</strong>. Click it to access the gallery — no password needed.
            </p>
            <button
              onClick={() => { setMode("email"); setError(null); }}
              style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Use a different method
            </button>
          </>
        )}

        {/* ── Email / magic link ── */}
        {mode === "email" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
              Sign in to view {title}
            </h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: 28, fontSize: "0.9rem" }}>
              Enter your email to receive a one-time sign-in link.
            </p>

            <form onSubmit={handleMagicLink} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                style={inputLargeStyle}
              />
              {error && <FieldError message={error} />}
              <button type="submit" disabled={loading} style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Sending…" : "Send sign-in link"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
              <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
            </div>

            <button
              onClick={() => { setMode("password"); setError(null); }}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: "var(--color-text-muted)",
                fontSize: "0.9rem",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Use a password instead
            </button>
          </>
        )}

        {/* ── Password ── */}
        {mode === "password" && (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>Enter Password</h1>
            <p style={{ color: "var(--color-text-muted)", marginBottom: 28, fontSize: "0.9rem" }}>
              Enter the gallery password to get access.
            </p>

            <form onSubmit={handlePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

            <button
              onClick={() => { setMode("email"); setError(null); }}
              style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Use email sign-in instead
            </button>
          </>
        )}

        {/* Admin bypass */}
        {isAdmin && mode !== "sent" && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--color-border)" }}>
            <button
              onClick={handleAdminBypass}
              disabled={bypassing || !galleryId}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "none",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: "var(--color-text-muted)",
                fontSize: "0.85rem",
                cursor: bypassing || !galleryId ? "not-allowed" : "pointer",
                opacity: bypassing ? 0.7 : 1,
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
