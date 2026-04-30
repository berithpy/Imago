import { useState, type ReactNode } from "react";

type Props = {
  emails: string[];
  onAdd: (email: string) => void | Promise<void>;
  onRemove: (email: string) => void | Promise<void>;
  adding?: boolean;
  removingEmail?: string | null;
  placeholder?: string;
  addButtonLabel?: string;
  label?: ReactNode;
};

const inputClass =
  "flex-1 min-w-0 px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";

export function EmailListInput({
  emails,
  onAdd,
  onRemove,
  adding,
  removingEmail,
  placeholder = "email@example.com",
  addButtonLabel = "Add",
  label,
}: Props) {
  const [draft, setDraft] = useState("");

  async function handleSubmit() {
    const trimmed = draft.trim().toLowerCase();
    if (!trimmed) return;
    if (emails.includes(trimmed)) {
      setDraft("");
      return;
    }
    await onAdd(trimmed);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-xs text-neutral-500">{label}</label>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={adding}
          className="px-4 py-2.5 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm cursor-pointer disabled:opacity-60"
        >
          {adding ? "..." : addButtonLabel}
        </button>
      </div>

      {emails.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-1">
          {emails.map((email) => (
            <li
              key={email}
              className="flex items-center gap-1.5 px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-md text-xs text-neutral-100"
            >
              <span>{email}</span>
              <button
                type="button"
                onClick={() => void onRemove(email)}
                disabled={removingEmail === email}
                className="bg-transparent border-0 text-red-400 cursor-pointer text-xs disabled:opacity-50"
                title={`Remove ${email}`}
                aria-label={`Remove ${email}`}
              >
                {removingEmail === email ? "..." : "X"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}