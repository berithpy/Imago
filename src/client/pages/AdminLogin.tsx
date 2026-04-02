import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { FieldError } from "@/client/components/ErrorMessage";
import { inputLargeStyle, fullWidthButtonStyle } from "@/client/components/ui";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [emailOTPClient()],
});

type Step = "email" | "otp" | "password";

export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    authClient.getSession({ fetchOptions: { credentials: "include" } })
      .then((res: any) => { if (res?.data?.session) navigate("/admin", { replace: true }); })
      .catch(() => { })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await (authClient as any).emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
        fetchOptions: { credentials: "include" },
      });
      if (err) {
        setError(err.message ?? "Failed to send code");
      } else {
        setStep("otp");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await (authClient as any).signIn.emailOtp({
        email,
        otp,
        fetchOptions: { credentials: "include" },
      });
      if (err) {
        setError(err.message ?? "Invalid code");
      } else {
        navigate("/admin");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
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

          {/* Step 1: email → send OTP */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoFocus
                style={inputLargeStyle}
              />
              {error && <FieldError message={error} />}
              <button type="submit" disabled={loading} style={{ ...fullWidthButtonStyle, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Sending…" : "Send sign-in code"}
              </button>
              <button
                type="button"
                onClick={() => { setError(null); setStep("password"); }}
                style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "0.85rem", cursor: "pointer", padding: 0, textAlign: "left" }}
              >
                Use password instead
              </button>
            </form>
          )}

          {/* Step 2: enter OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", margin: 0 }}>
                A 6-digit code was sent to <strong>{email}</strong>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                autoFocus
                style={{ ...inputLargeStyle, letterSpacing: "0.25em", textAlign: "center" }}
              />
              {error && <FieldError message={error} />}
              <button type="submit" disabled={loading || otp.length !== 6} style={{ ...fullWidthButtonStyle, opacity: loading || otp.length !== 6 ? 0.7 : 1 }}>
                {loading ? "Verifying…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setOtp(""); setError(null); setStep("email"); }}
                style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "0.85rem", cursor: "pointer", padding: 0, textAlign: "left" }}
              >
                ← Back
              </button>
            </form>
          )}

          {/* Password fallback */}
          {step === "password" && (
            <form onSubmit={handlePasswordSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              <button
                type="button"
                onClick={() => { setError(null); setStep("email"); }}
                style={{ background: "none", border: "none", color: "var(--color-text-muted)", fontSize: "0.85rem", cursor: "pointer", padding: 0, textAlign: "left" }}
              >
                ← Use sign-in code instead
              </button>
            </form>
          )}

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


