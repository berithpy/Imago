import { useState } from "react";
import { FieldError } from "@/client/components/ErrorMessage";

type Props = {
  title: string;
  subtitle?: string;
  showPasswordFallback?: boolean;
  showAdminBypass?: boolean;
  bypassLoading?: boolean;
  onMagicLink: (email: string) => Promise<void>;
  onPassword?: (password: string) => Promise<void>;
  onAdminBypass?: () => Promise<void>;
};

const cardClass = "w-full max-w-[420px] bg-neutral-900 border border-neutral-800 rounded-lg px-10 py-12";
const inputLargeClass =
  "w-full px-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 text-base outline-none";
const fullWidthAccentClass =
  "w-full px-5 py-3.5 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-base cursor-pointer disabled:opacity-60";
const ghostFullWidthClass =
  "w-full px-5 py-3.5 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-base cursor-pointer disabled:opacity-60";

export function LoginCard({
  title,
  subtitle,
  showPasswordFallback,
  showAdminBypass,
  bypassLoading,
  onMagicLink,
  onPassword,
  onAdminBypass,
}: Props) {
  const [mode, setMode] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onMagicLink(email);
      setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onPassword) return;
    setError(null);
    setSubmitting(true);
    try {
      await onPassword(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={cardClass}>
        <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-neutral-500 mb-5">
          Imago
        </p>
        <h1 className="text-[1.4rem] font-bold mb-2">{title}</h1>
        {subtitle && <p className="text-neutral-500 text-sm mb-6">{subtitle}</p>}

        {emailSent ? (
          <div className="text-amber-400 text-sm">
            Check your inbox for the sign-in link.
          </div>
        ) : mode === "email" ? (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className={inputLargeClass}
            />
            {error && <FieldError message={error} />}
            <button type="submit" disabled={submitting} className={fullWidthAccentClass}>
              {submitting ? "Sending..." : "Send magic link"}
            </button>
            {showPasswordFallback && onPassword && (
              <button
                type="button"
                onClick={() => { setMode("password"); setError(null); }}
                className={ghostFullWidthClass}
              >
                Use password instead
              </button>
            )}
            {showAdminBypass && onAdminBypass && (
              <button
                type="button"
                onClick={onAdminBypass}
                disabled={bypassLoading}
                className={ghostFullWidthClass}
              >
                {bypassLoading ? "..." : "Admin: enter as viewer"}
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoFocus
              className={inputLargeClass}
            />
            {error && <FieldError message={error} />}
            <button type="submit" disabled={submitting} className={fullWidthAccentClass}>
              {submitting ? "Signing in..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("email"); setError(null); }}
              className={ghostFullWidthClass}
            >
              Use magic link instead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}