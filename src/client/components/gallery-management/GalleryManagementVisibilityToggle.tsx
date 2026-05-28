type Props = {
  isPublic: boolean;
  disabled?: boolean;
  onChange: () => void;
};

export function GalleryManagementVisibilityToggle({ isPublic, disabled, onChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-neutral-100">
          {isPublic ? "Public gallery" : "Private gallery"}
        </span>
        <span className="text-[0.78rem] text-neutral-500">
          {isPublic
            ? "Anyone with the link can view without a password."
            : "Viewers need a password or an invite to access."}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isPublic}
        aria-label={isPublic ? "Make gallery private" : "Make gallery public"}
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
  );
}
