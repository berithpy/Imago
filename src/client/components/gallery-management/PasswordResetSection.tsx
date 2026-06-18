import { useState } from "react";
import { useTenant } from "@/client/lib/tenantContext";
import { PasswordField } from "@/client/components/PasswordField";

type Props = {
  galleryId: string;
};

export function PasswordResetSection({ galleryId }: Props) {
  const { apiBase } = useTenant();
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetDone, setPasswordResetDone] = useState(false);

  async function handleResetPassword() {
    if (!newPassword) return;
    setResettingPassword(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error();
      setNewPassword("");
      setPasswordResetDone(true);
      setTimeout(() => setPasswordResetDone(false), 2500);
    } catch {
      alert("Failed to reset password.");
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div >
      <label className="text-xs text-neutral-500 block mb-1.5">Reset gallery password</label>
      <PasswordField
        value={newPassword}
        onChange={setNewPassword}
        placeholder="New password"
        onAction={handleResetPassword}
        actionLoading={resettingPassword}
        actionDone={passwordResetDone}
        showGenerate
      />
    </div>
  );
}
