import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldError } from "@/client/components/ErrorMessage";
import { cardStyle, inputLargeStyle, fullWidthButtonStyle } from "@/client/components/ui";
import { useTenant } from "@/client/lib/tenantContext";

export function AdminSetup() {
  const navigate = useNavigate();
  const { routeBase } = useTenant();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, recoveryEmail: recoveryEmail || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setDone(true);
        setTimeout(() => navigate(`${routeBase}/admin/login`), 2000);
      } else {
        setError(data.error ?? "Setup failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--color-accent)", fontSize: "1.1rem" }}>
          ✓ Admin account created. Redirecting to login…
        </p>
      </div>
    );
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
        <div style={{ ...cardStyle, padding: "32px 28px" }}>
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

          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px" }}>
            Admin Setup
          </h1>
          <p style={{ color: "var(--color-text-muted)", margin: "0 0 24px", fontSize: "0.9rem" }}>
            Create the admin account. This can only be done once.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
              style={inputLargeStyle}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              style={inputLargeStyle}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              required
              minLength={8}
              style={inputLargeStyle}
            />
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="Recovery email (optional, defaults to admin email)"
              style={inputLargeStyle}
            />

            {error && <FieldError message={error} />}

            <button
              type="submit"
              disabled={loading}
              style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Creating…" : "Create Admin Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
