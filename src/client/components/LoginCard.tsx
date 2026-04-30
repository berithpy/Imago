import { useState } from "react";
import { FieldError } from "@/client/components/ErrorMessage";
import { Button } from "@/client/components/Button";

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

const cardClass = "w-full max-w-[420px] min-h-[340px] bg-neutral-900 border border-neutral-800 rounded-lg px-10 py-12";
const inputLargeClass =
  "w-full px-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 text-base outline-none";

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
        {subtitle && !emailSent && <p className="text-neutral-500 text-sm mb-6">{subtitle}</p>}

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
            <Button type="submit" size="lg" loading={submitting} analyticsId="login_submit" analyticsParams={{ login_mode: "magic_link" }} className="w-full">
              {submitting ? "Sending..." : "Send magic link"}
            </Button>
            {showPasswordFallback && onPassword && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => { setMode("password"); setError(null); }}
                analyticsId="login_toggle_magic_link"
                analyticsParams={{ to_mode: "password" }}
                className="w-full"
              >
                Use password instead
              </Button>
            )}
            {showAdminBypass && onAdminBypass && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onAdminBypass}
                loading={bypassLoading}
                analyticsId="login_admin_bypass"
                className="w-full"
              >
                {bypassLoading ? "..." : "Admin: enter as viewer"}
              </Button>
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
            <Button type="submit" size="lg" loading={submitting} analyticsId="login_submit" analyticsParams={{ login_mode: "password" }} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => { setMode("email"); setError(null); }}
              analyticsId="login_toggle_magic_link"
              analyticsParams={{ to_mode: "magic_link" }}
              className="w-full"
            >
              Use magic link instead
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}