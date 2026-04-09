import { useState } from "react";
import { PasswordField } from "@/client/components/PasswordField";

type Props = {
  galleryId: string;
};

export function GalleryManagementPasswordResetSection({ galleryId }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetDone, setPasswordResetDone] = useState(false);

  async function handleResetPassword() {
    if (!newPassword) return;
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/admin/galleries/${galleryId}/password`, {
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
    <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
      <label
        style={{
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          display: "block",
          marginBottom: 6,
        }}
      >
        Reset gallery password
      </label>
      <PasswordField
        value={newPassword}
        onChange={setNewPassword}
        placeholder="New password"
        onAction={handleResetPassword}
        actionLoading={resettingPassword}
        actionDone={passwordResetDone}
        showGenerate={true}
      />
    </div>
  );
}
