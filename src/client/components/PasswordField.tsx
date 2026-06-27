import { useState, type Ref } from "react";
import { generatePassword } from "@/client/lib/generatePassword";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  showGenerate?: boolean;
  onAction?: () => void;
  actionLoading?: boolean;
  actionDone?: boolean;
  actionLabel?: string;
  actionLoadingLabel?: string;
  actionDoneLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

const inputClass =
  "flex-1 min-w-0 px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none";
const buttonClass =
  "px-4 py-2.5 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer disabled:opacity-50";

export function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  required,
  showGenerate,
  onAction,
  actionLoading,
  actionDone,
  actionLabel = "Save",
  actionLoadingLabel = "Saving...",
  actionDoneLabel = "Saved!",
  autoFocus,
  disabled,
  inputRef,
}: Props) {
  const [reveal, setReveal] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={inputRef}
        type={reveal ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setReveal((v) => !v)}
        disabled={disabled}
        className={buttonClass}
        title={reveal ? "Hide" : "Reveal"}
      >
        {reveal ? "Hide" : "Show"}
      </button>
      {showGenerate && (
        <button
          type="button"
          onClick={() => onChange(generatePassword())}
          disabled={disabled}
          className={buttonClass}
          title="Generate password"
        >
          Generate
        </button>
      )}
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled || actionLoading}
          className="px-4 py-2.5 bg-amber-400 border-0 rounded-lg text-neutral-950 text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          {actionDone ? actionDoneLabel : actionLoading ? actionLoadingLabel : actionLabel}
        </button>
      )}
    </div>
  );
}