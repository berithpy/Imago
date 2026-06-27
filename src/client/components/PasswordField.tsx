import { useState, type Ref } from "react";
import { generatePassword } from "@/client/lib/generatePassword";
import { getPasswordInputClassName } from "@/client/lib/passwordFieldClasses";

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
  inputLoading?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

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
  inputLoading = false,
  autoFocus,
  disabled,
  inputRef,
}: Props) {
  const [reveal, setReveal] = useState(false);
  const hasSecondaryActions = Boolean(showGenerate || onAction);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex w-full min-w-0 gap-2 sm:flex-1 sm:min-w-[18rem]">
        <input
          ref={inputRef}
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          className={getPasswordInputClassName(inputLoading)}
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          disabled={disabled}
          className={`${buttonClass} shrink-0`}
          title={reveal ? "Hide" : "Reveal"}
        >
          {reveal ? "Hide" : "Show"}
        </button>
      </div>
      {hasSecondaryActions ? (
        <div className="flex w-full gap-2 sm:w-auto sm:flex-wrap sm:justify-end">
          {showGenerate && (
            <button
              type="button"
              onClick={() => onChange(generatePassword())}
              disabled={disabled}
              className={`${buttonClass} flex-1 sm:flex-none`}
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
              className="flex-1 px-4 py-2.5 bg-amber-400 border-0 rounded-lg text-neutral-950 text-sm font-semibold cursor-pointer disabled:opacity-60 sm:flex-none"
            >
              {actionDone ? actionDoneLabel : actionLoading ? actionLoadingLabel : actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}