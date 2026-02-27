import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function AdminSetup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setDone(true);
        setTimeout(() => navigate("/admin/login"), 2000);
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
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
          Admin Setup
        </h1>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 32, fontSize: "0.9rem" }}>
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
            style={inputStyle}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            required
            minLength={8}
            style={inputStyle}
          />

          {error && (
            <p style={{ color: "var(--color-error)", fontSize: "0.875rem" }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Creating…" : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  color: "var(--color-text)",
  fontSize: "1rem",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  background: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius)",
  color: "#0f0f0f",
  fontSize: "1rem",
  fontWeight: 600,
};
