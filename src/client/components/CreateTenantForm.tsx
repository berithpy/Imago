import { useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { Button } from "@/client/components/Button";
import { FieldError } from "@/client/components/ErrorMessage";

const cardClass = "bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-5";
const inputClass =
  "w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";
const accentBtnClass =
  "inline-block px-5 py-2.5 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

type Props = {
  onCreated: () => void;
  onCancel: () => void;
};

export function SlugIndicator({ status }: { status: SlugStatus }) {
  if (status === "checking") return <span className="text-[0.78rem] text-neutral-500">Checking...</span>;
  if (status === "available") return <span className="text-[0.78rem] text-amber-400">+ Available</span>;
  if (status === "taken") return <span className="text-[0.78rem] text-red-400">X Already in use</span>;
  if (status === "invalid") return <span className="text-[0.78rem] text-red-400">X Only lowercase letters, numbers, dashes</span>;
  return null;
}

export async function checkTenantSlug(slug: string): Promise<SlugStatus> {
  if (!slug) return "idle";
  const res = await fetch(`/api/operator/tenants/check-slug?slug=${encodeURIComponent(slug)}`);
  const data = await res.json() as { valid: boolean; available: boolean };
  if (!data.valid) return "invalid";
  return data.available ? "available" : "taken";
}

function slugBorder(status: SlugStatus): string {
  if (status === "available") return "border-amber-400";
  if (status === "taken" || status === "invalid") return "border-red-400";
  return "border-neutral-800";
}

function scheduleSlugCheck(
  slug: string,
  setStatus: (status: SlugStatus) => void,
  timer: MutableRefObject<ReturnType<typeof setTimeout> | null>
) {
  if (!slug) {
    setStatus("idle");
    return;
  }
  setStatus("checking");
  if (timer.current) clearTimeout(timer.current);
  timer.current = setTimeout(async () => {
    setStatus(await checkTenantSlug(slug));
  }, 400);
}

export function CreateTenantForm({ onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    const derived = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setSlug(derived);
    scheduleSlugCheck(derived, setSlugStatus, slugTimer);
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    scheduleSlugCheck(value, setSlugStatus, slugTimer);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/operator/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ slug, name }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create");
        return;
      }
      setName("");
      setSlug("");
      setSlugStatus("idle");
      onCreated();
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-3.5 mb-5`}>
      <h3 className="font-semibold text-[0.95rem] mb-1">New Tenant</h3>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        required
        className={inputClass}
      />
      <div className="flex flex-col gap-1">
        <input
          placeholder="Slug"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          required
          pattern="[a-z0-9-]+"
          className={`w-full px-4 py-3 bg-neutral-950 border ${slugBorder(slugStatus)} rounded-lg text-neutral-100 text-sm outline-none`}
        />
        <SlugIndicator status={slugStatus} />
      </div>
      {error && <FieldError message={error} />}
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={creating || slugStatus === "taken" || slugStatus === "invalid"}
          loading={creating}
          analyticsId="operator_create_tenant_submit"
          className={accentBtnClass}
        >
          {creating ? "Creating..." : "Create Tenant"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          analyticsId="operator_create_tenant_cancel"
          className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}