import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { FieldError } from "@/client/components/ErrorMessage";
import { inputLargeStyle, fullWidthButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    authClient.getSession({ fetchOptions: { credentials: "include" } })
      .then(({ data }) => { if (data?.session) navigate("/admin", { replace: true }); })
      .catch(() => { })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
        fetchOptions: { credentials: "include" },
      });

      if (authError) {
        setError(authError.message ?? "Invalid credentials");
      } else {
        navigate("/admin");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
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
      {checkingSession ? null : (
        <div style={{ width: "100%", maxWidth: 380 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
            Admin Login
          </h1>
          <p style={{ color: "var(--color-text-muted)", marginBottom: 32, fontSize: "0.9rem" }}>
            Sign in to manage galleries and photos.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoFocus
              style={inputLargeStyle}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              style={inputLargeStyle}
            />

            {error && <FieldError message={error} />}

            <button type="submit" disabled={loading} style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <a href="/" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              ← Back to galleries
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
