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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicSubmitting, setMagicSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const helperText = emailSent
    ? "Check your inbox and spam folder for the sign-in link. If it does not arrive, contact support."
    : subtitle;

  const showPasswordForm = !!(showPasswordFallback && onPassword);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailSent || magicSubmitting) return;
    setMagicError(null);
    setMagicSubmitting(true);
    try {
      await onMagicLink(email);
      setEmailSent(true);
    } catch (err) {
      setMagicError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setMagicSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onPassword) return;
    setPasswordError(null);
    setPasswordSubmitting(true);
    try {
      await onPassword(password);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className={cardClass}>
        <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-neutral-500 mb-5">
          Imago
        </p>
        <h1 className="text-[1.4rem] font-bold mb-2">{title}</h1>
        {helperText && (
          <p className={`text-sm mb-6 ${emailSent ? "text-amber-400" : "text-neutral-500"}`}>
            {helperText}
          </p>
        )}

        <div className="flex flex-col gap-6">
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus={!emailSent}
              disabled={emailSent}
              className={inputLargeClass}
            />
            {magicError && <FieldError message={magicError} />}
            <Button
              type="submit"
              size="lg"
              loading={magicSubmitting}
              disabled={emailSent}
              analyticsId="login_submit"
              analyticsParams={{ login_mode: "magic_link" }}
              className="w-full"
            >
              {magicSubmitting ? "Sending..." : emailSent ? "Link sent" : "Send magic link"}
            </Button>
          </form>

          {showPasswordForm && (
            <>
              <div className="flex items-center gap-3 text-neutral-600 text-xs uppercase tracking-[0.12em]">
                <span className="flex-1 h-px bg-neutral-800" />
                or
                <span className="flex-1 h-px bg-neutral-800" />
              </div>

              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className={inputLargeClass}
                />
                {passwordError && <FieldError message={passwordError} />}
                <Button type="submit" size="lg" loading={passwordSubmitting} analyticsId="login_submit" analyticsParams={{ login_mode: "password" }} className="w-full">
                  {passwordSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </>
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
        </div>
      </div>
    </div>
  );
}