import { useEffect, useState } from "react";
import { useTenant } from "@/client/lib/tenantContext";
import { EmailListInput } from "@/client/components/EmailListInput";
import type { AllowedEmail } from "@/client/lib/galleryManagement";

type Props = {
  galleryId: string;
};

export function GalleryManagementEmailWhitelistSection({ galleryId }: Props) {
  const { apiBase } = useTenant();
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [addingEmail, setAddingEmail] = useState(false);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  useEffect(() => { void loadAllowedEmails(); }, [galleryId]);

  async function loadAllowedEmails() {
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/allowed-emails`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { allowedEmails: AllowedEmail[] };
      setAllowedEmails(data.allowedEmails ?? []);
    } catch {
      // ignore
    }
  }

  async function handleAddEmail(email: string) {
    setAddingEmail(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries/${galleryId}/allowed-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; id?: string };
      if (res.ok && data.id) {
        setAllowedEmails((prev) => [
          ...prev,
          { id: data.id!, email: email.toLowerCase(), added_at: Math.floor(Date.now() / 1000) },
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
      await fetch(`${apiBase}/admin/galleries/${galleryId}/allowed-emails/${encodeURIComponent(email)}`, {
        method: "DELETE",
        credentials: "include",
      });
      setAllowedEmails((prev) => prev.filter((entry) => entry.email !== email));
    } finally {
      setRemovingEmail(null);
    }
  }

  return (
    <div className="mb-8 px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-lg">
      <div className="flex flex-row gap-2 mb-3 items-end">
        <h3 className="font-semibold text-base">Allowed email addresses</h3>
        <span className="font-normal text-xs text-neutral-500">
          For passwordless login with magic-links
        </span>
      </div>
      <EmailListInput
        emails={allowedEmails.map((e) => e.email)}
        onAdd={handleAddEmail}
        onRemove={handleRemoveEmail}
        adding={addingEmail}
        removingEmail={removingEmail}
        placeholder="Add email address..."
        addButtonLabel="Add & invite"
      />
    </div>
  );
}
