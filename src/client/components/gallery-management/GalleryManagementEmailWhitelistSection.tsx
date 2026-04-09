import { useEffect, useState } from "react";
import { EmailListInput } from "@/client/components/EmailListInput";
import type { AllowedEmail } from "@/client/lib/galleryManagement";

type Props = {
  galleryId: string;
};

export function GalleryManagementEmailWhitelistSection({ galleryId }: Props) {
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [addingEmail, setAddingEmail] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  useEffect(() => {
    void loadAllowedEmails();
  }, [galleryId]);

  async function loadAllowedEmails() {
    try {
      const res = await fetch(`/api/admin/galleries/${galleryId}/allowed-emails`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { allowedEmails: AllowedEmail[] };
      setAllowedEmails(data.allowedEmails ?? []);
    } catch {
      // Keep UI functional even if whitelist fetch fails.
    }
  }

  async function handleAddEmail(email: string) {
    setAddingEmail(true);
    try {
      const res = await fetch(`/api/admin/galleries/${galleryId}/allowed-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; id?: string };
      const createdId = data.id;
      if (res.ok && createdId) {
        setAllowedEmails((prev) => [
          ...prev,
          {
            id: createdId,
            email: email.toLowerCase(),
            added_at: Math.floor(Date.now() / 1000),
          },
        ]);
      } else {
        alert(data.error ?? "Failed to add email");
      }
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleRemoveEmail(email: string) {
    setRemovingEmail(email);
    try {
      await fetch(`/api/admin/galleries/${galleryId}/allowed-emails/${encodeURIComponent(email)}`, {
        method: "DELETE",
        credentials: "include",
      });
      setAllowedEmails((prev) => prev.filter((entry) => entry.email !== email));
    } finally {
      setRemovingEmail(null);
    }
  }

  return (
    <div
      style={{
        marginBottom: 32,
        padding: "20px 24px",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", gap: 8, marginBottom: 12 }}>

        <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>
          Allowed email addresses
        </h3>
        <span
          style={{
            marginTop: "auto",
            fontWeight: 400,
            fontSize: "0.8rem",
            color: "var(--color-text-muted)",
            marginBottom: "auto",
          }}
        >
          For passwordless login with magic-links
        </span>
      </div>
      <EmailListInput
        emails={allowedEmails.map((e) => e.email)}
        onAdd={handleAddEmail}
        onRemove={handleRemoveEmail}
        adding={addingEmail}
        removingEmail={removingEmail}
        placeholder="Add email address…"
        addButtonLabel="Add & invite"
      />
    </div>
  );
}
