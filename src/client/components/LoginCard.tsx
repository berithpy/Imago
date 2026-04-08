import { useState } from "react";
import { FieldError } from "@/client/components/ErrorMessage";
import {
  cardStyle,
  inputLargeStyle,
  fullWidthButtonStyle,
  ghostButtonStyle,
} from "@/client/components/ui";

export interface LoginCardProps {
  /** Displayed as the page title, e.g. "Admin" or a gallery name */
  title: string;
  /** Secondary descriptor shown below the title */
  subtitle?: string;
  /** Show the "Use a password instead" path (gallery only) */
  showPasswordFallback?: boolean;
  /** Show the admin bypass button (gallery only, when admin session is active) */
  showAdminBypass?: boolean;
  bypassLoading?: boolean;
  /** Called with the submitted email address */
  onMagicLink: (email: string) => Promise<void>;
  /** Called with the submitted password (required when showPasswordFallback is true) */
  onPassword?: (password: string) => Promise<void>;
  /** Called when the admin bypass button is clicked */
  onAdminBypass?: () => Promise<void>;
}

type Step = "email" | "sent" | "password";

export function LoginCard({
  title,
  subtitle,
  showPasswordFallback,
  showAdminBypass,
  bypassLoading,
  onMagicLink,
  onPassword,
  onAdminBypass,
}: LoginCardProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onMagicLink(email);
      setStep("sent");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onPassword!(password);
    } catch (err: any) {
      setError(err?.message ?? "Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    setStep("email");
    setError(null);
  }

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
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            ...cardStyle,
            padding: "32px 28px",
          }}
        >
          {/* Wordmark */}
          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              margin: "0 0 20px",
            }}
          >
            Imago
          </p>

          {/* ── Magic link sent ── */}
          {step === "sent" && (
            <>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--color-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                  marginBottom: 16,
                }}
              >
                ✉
              </div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px" }}>
                Check your inbox
              </h1>
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  margin: "0 0 24px",
                }}
              >
                A sign-in link was sent to <strong>{email}</strong>. Click it to
                continue — no password needed.
              </p>
              <button
                onClick={goBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ← Use a different email
              </button>
            </>
          )}

          {/* ── Email / magic link ── */}
          {step === "email" && (
            <>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px" }}>
                Sign in{title ? ` — ${title}` : ""}
              </h1>
              {subtitle && (
                <p
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "0.9rem",
                    margin: "0 0 24px",
                  }}
                >
                  {subtitle}
                </p>
              )}

              <form
                onSubmit={handleMagicLink}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
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
                <button
                  type="submit"
                  disabled={loading}
                  style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? "Sending…" : "Send sign-in link"}
                </button>
              </form>

              {showPasswordFallback && (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      margin: "20px 0",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                    <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                      or
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                  </div>
                  <button
                    onClick={() => { setStep("password"); setError(null); }}
                    style={{
                      ...ghostButtonStyle,
                      width: "100%",
                      padding: "11px 16px",
                      fontSize: "0.9rem",
                      textAlign: "center",
                    }}
                  >
                    Use a password instead
                  </button>
                </>
              )}
            </>
          )}

          {/* ── Password ── */}
          {step === "password" && (
            <>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px" }}>
                Enter Password
              </h1>
              <p
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.9rem",
                  margin: "0 0 24px",
                }}
              >
                Enter the gallery password to get access.
              </p>

              <form
                onSubmit={handlePassword}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
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
                <button
                  type="submit"
                  disabled={loading}
                  style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? "Checking…" : "View Gallery"}
                </button>
              </form>

              <button
                onClick={goBack}
                style={{
                  marginTop: 16,
                  background: "none",
                  border: "none",
                  color: "var(--color-text-muted)",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ← Use email sign-in instead
              </button>
            </>
          )}
        </div>

        {/* Admin bypass — outside card, below */}
        {showAdminBypass && step !== "sent" && (
          <div style={{ marginTop: 16 }}>
            {bypassError && <FieldError message={bypassError} />}
            <button
              onClick={async () => {
                setBypassError(null);
                try {
                  await onAdminBypass!();
                } catch (err: any) {
                  setBypassError(err?.message ?? "Bypass failed. Please try again.");
                }
              }}
              disabled={bypassLoading}
              style={{
                ...ghostButtonStyle,
                width: "100%",
                padding: "10px 16px",
                fontSize: "0.85rem",
                marginTop: bypassError ? 8 : 0,
                opacity: bypassLoading ? 0.7 : 1,
                cursor: bypassLoading ? "not-allowed" : "pointer",
              }}
            >
              {bypassLoading ? "Bypassing…" : "🔑 Enter as admin (skip password)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
