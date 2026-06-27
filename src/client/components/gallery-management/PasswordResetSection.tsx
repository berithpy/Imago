import { useRef, useState } from "react";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { useTenant } from "@/client/lib/tenantContext";
import { PasswordField } from "@/client/components/PasswordField";

type Props = {
  galleryId: string;
  pendingPrivateCompletion?: boolean;
  onPrivateCompletion?: () => Promise<void>;
  onCancelPrivateCompletion?: () => void;
  onPasswordSaved?: (password: string) => void;
};

export function PasswordResetSection({
  galleryId,
  pendingPrivateCompletion = false,
  onPrivateCompletion,
  onCancelPrivateCompletion,
  onPasswordSaved,
}: Props) {
  const { apiBase } = useTenant();
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetDone, setPasswordResetDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  async function handleResetPassword() {
    if (!newPassword) return;
    const submittedPassword = newPassword;
    setError(null);
    setResettingPassword(true);
    let passwordSaved = false;
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) {
        let responseError: string | null = null;
        try {
          const data = (await res.json()) as { error?: string; message?: string };
          responseError = data.error ?? data.message ?? null;
        } catch {
          responseError = null;
        }
        throw new Error(responseError ?? "Failed to save the gallery password.");
      }
      passwordSaved = true;
      if (pendingPrivateCompletion && onPrivateCompletion) {
        await onPrivateCompletion();
      }
      onPasswordSaved?.(submittedPassword);
      setNewPassword("");
      setPasswordResetDone(true);
      setTimeout(() => setPasswordResetDone(false), 2500);
    } catch (err) {
      const resolvedError = err instanceof Error && err.message ? err.message : null;
      setError(
        passwordSaved && pendingPrivateCompletion
          ? "Password saved, but the gallery is still public. Try again to finish making it private."
          : resolvedError ?? "Failed to save the gallery password."
      );
      passwordInputRef.current?.focus();
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div>
      <label className="text-xs text-neutral-500 block mb-1.5">
        {pendingPrivateCompletion ? "Set gallery password" : "Reset gallery password"}
      </label>
      <div
        aria-busy={resettingPassword ? "true" : undefined}
        className="py-0.5"
      >
        {pendingPrivateCompletion ? (
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-amber-300">
                Set a viewer password below to finish making this gallery private.
              </p>
              <p className="mt-1 text-[0.78rem] text-neutral-500">
                The visibility change will not be applied until the password is saved.
              </p>
            </div>
            {onCancelPrivateCompletion ? (
              <button
                type="button"
                onClick={onCancelPrivateCompletion}
                disabled={resettingPassword}
                className="px-3 py-1.5 rounded-lg border border-neutral-800 text-xs text-neutral-500 disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}
        <PasswordField
          value={newPassword}
          onChange={setNewPassword}
          placeholder="New password"
          onAction={handleResetPassword}
          actionLoading={resettingPassword}
          actionDone={passwordResetDone}
          actionLabel={pendingPrivateCompletion ? "Save password & make private" : "Save"}
          actionLoadingLabel={pendingPrivateCompletion ? "Saving & locking..." : "Saving..."}
          inputLoading={resettingPassword}
          showGenerate
          autoFocus={pendingPrivateCompletion}
          inputRef={passwordInputRef}
        />
      </div>
      {error ? <ErrorMessage message={error} /> : null}
    </div>
  );
}
