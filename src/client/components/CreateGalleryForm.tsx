import { useState, useRef } from "react";
import { FieldError } from "@/client/components/ErrorMessage";
import { PasswordField } from "@/client/components/PasswordField";
import { EmailListInput } from "@/client/components/EmailListInput";
import { useTenant } from "@/client/lib/tenantContext";

const inputClass =
  "w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";
const inputPanelClass =
  "px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";
const accentBtnClass =
  "inline-block px-5 py-2.5 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";

type Props = {
  onCreated: () => void;
  onCancel: () => void;
};

export function CreateGalleryForm({ onCreated, onCancel }: Props) {
  const { apiBase } = useTenant();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [emailList, setEmailList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "reserved" | "invalid">("idle");
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function checkSlug(value: string) {
    if (!value) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current);
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/admin/galleries/check-slug?slug=${encodeURIComponent(value)}`, { credentials: "include" });
        const data = await res.json() as { valid: boolean; available: boolean; reserved: boolean };
        if (!data.valid) setSlugStatus("invalid");
        else if (data.reserved) setSlugStatus("reserved");
        else if (!data.available) setSlugStatus("taken");
        else setSlugStatus("available");
      } catch {
        setSlugStatus("idle");
      }
    }, 400);
  }

  function handleNameChange(v: string) {
    setName(v);
    const derived = v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSlug(derived);
    checkSlug(derived);
  }

  function handleSlugChange(v: string) {
    setSlug(v);
    checkSlug(v);
  }

  function handleTogglePublic() {
    setIsPublic((v) => !v);
    if (!isPublic) setPassword("");
  }

  function handleAddEmailToList(email: string) {
    if (!email || emailList.includes(email)) return;
    setEmailList((prev) => [...prev, email]);
  }

  function handleRemoveFromList(email: string) {
    setEmailList((prev) => prev.filter((e) => e !== email));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/admin/galleries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          slug,
          password: isPublic ? "" : password,
          description: description || undefined,
          is_public: isPublic,
          event_date: eventDate ? Math.floor(new Date(eventDate).getTime() / 1000) : null,
          expires_at: expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null,
        }),
      });
      const data = await res.json() as { error?: string; gallery?: { id: string } };
      if (res.ok) {
        if (emailList.length > 0 && data.gallery?.id) {
          await Promise.all(
            emailList.map((email) =>
              fetch(`${apiBase}/admin/galleries/${data.gallery!.id}/allowed-emails`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ email }),
              })
            )
          );
        }
        onCreated();
      } else {
        setError(data.error ?? "Failed to create gallery");
      }
    } finally {
      setCreating(false);
    }
  }

  const slugBorder =
    slugStatus === "available"
      ? "border-amber-400"
      : slugStatus === "taken" || slugStatus === "reserved" || slugStatus === "invalid"
        ? "border-red-400"
        : "border-neutral-800";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-neutral-900 border border-neutral-800 rounded-lg px-5 py-4 mb-6 flex flex-col gap-3"
    >
      <h3 className="font-semibold mb-1">New Gallery</h3>

      <input
        placeholder="Name"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        required
        className={inputClass}
      />
      <input
        placeholder="Slug (URL)"
        value={slug}
        onChange={(e) => handleSlugChange(e.target.value)}
        required
        pattern="[-a-z0-9]+"
        className={`w-full px-4 py-3 bg-neutral-950 border ${slugBorder} rounded-lg text-neutral-100 text-sm outline-none`}
      />
      {slugStatus === "checking" && <p className="text-[0.78rem] text-neutral-500 -mt-1">Checking...</p>}
      {slugStatus === "available" && <p className="text-[0.78rem] text-amber-400 -mt-1">Available</p>}
      {slugStatus === "taken" && <p className="text-[0.78rem] text-red-400 -mt-1">Already in use</p>}
      {slugStatus === "reserved" && <p className="text-[0.78rem] text-red-400 -mt-1">Reserved word</p>}
      {slugStatus === "invalid" && <p className="text-[0.78rem] text-red-400 -mt-1">Only lowercase letters, numbers, dashes</p>}

      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        autoComplete="off"
        className={inputClass}
      />

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleTogglePublic}
          className={`px-4 py-2 border border-neutral-800 rounded-lg text-sm cursor-pointer transition-colors ${isPublic ? "bg-amber-400 text-neutral-950 font-semibold" : "bg-transparent text-neutral-500"
            }`}
        >
          {isPublic ? "Public" : "Private"}
        </button>
        <span className="text-xs text-neutral-500">
          {isPublic ? "No password required" : "Viewers need a password"}
        </span>
      </div>

      {!isPublic && (
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Viewer password"
          required
          showGenerate
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Event date (optional)</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={inputPanelClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Expires at (optional)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={inputPanelClass}
          />
        </div>
      </div>

      <EmailListInput
        emails={emailList}
        onAdd={handleAddEmailToList}
        onRemove={handleRemoveFromList}
        placeholder="viewer@example.com"
        label={
          <>
            Allowed email addresses{" "}
            <span className="italic">
              (optional - passwordless OTP access; invite emails are sent on creation)
            </span>
          </>
        }
      />
      {error && <FieldError message={error} />}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={creating || slugStatus === "taken" || slugStatus === "reserved" || slugStatus === "invalid"}
          className={accentBtnClass}
        >
          {creating ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}