type Props = {
  isPublic: boolean;
  loading?: boolean;
  disabled?: boolean;
  onChange: () => void;
};

export function VisibilityToggle({ isPublic, loading, disabled, onChange }: Props) {
  const visibilityDescription = isPublic
    ? "Anyone with the link can view this gallery."
    : "Only you and invited people can view this gallery.";

  return (
    <section>
      <label className="text-xs text-neutral-500">Gallery visibility</label>
      <div
        aria-busy={loading ? "true" : undefined}
        className={`px-3 py-2.5 bg-neutral-950 border rounded-lg transition-colors ${loading ? "gm-animated-border border-amber-400" : "border-neutral-800"
          }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-neutral-100">Public gallery</span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label={isPublic ? "Set gallery visibility to private" : "Set gallery visibility to public"}
            disabled={disabled}
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isPublic ? "bg-amber-400" : "bg-neutral-700"
              }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-neutral-950 transition-transform ${isPublic ? "translate-x-[1.375rem]" : "translate-x-0.5"
                }`}
            />
          </button>
        </div>
        <p className="mt-2 text-[0.78rem] text-neutral-500">{visibilityDescription}</p>
      </div>
    </section>
  );
}
