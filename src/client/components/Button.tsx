import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Spinner } from "@/client/components/Spinner";
import { track } from "@/client/lib/analytics";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type AnalyticsProps = {
  /** Stable identifier for this CTA. Sent to GA as `event_label`. */
  analyticsId: string;
  /** GA event name. Defaults to `cta_click`. */
  analyticsEvent?: string;
  /** Extra params merged into the GA payload. Do NOT include PII. */
  analyticsParams?: Record<string, unknown>;
};

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-base",
};

const variantClass: Record<ButtonVariant, string> = {
  // Matches the existing `fullWidthAccentClass` look in LoginCard.
  primary:
    "bg-amber-400 border-0 text-neutral-950 font-semibold hover:bg-amber-300",
  secondary:
    "bg-transparent border border-neutral-800 text-neutral-100 hover:border-neutral-700",
  ghost:
    "bg-transparent border border-neutral-800 text-neutral-500 hover:text-neutral-300",
  danger:
    "bg-red-500 border-0 text-neutral-950 font-semibold hover:bg-red-400",
};

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

function buildClassName(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return [baseClass, sizeClass[size], variantClass[variant], extra ?? ""]
    .filter(Boolean)
    .join(" ");
}

// ---------- Button ----------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  StyleProps &
  AnalyticsProps & {
    loading?: boolean;
    children?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled,
    className,
    onClick,
    analyticsId,
    analyticsEvent = "cta_click",
    analyticsParams,
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (!isDisabled) {
      track(analyticsEvent, { event_label: analyticsId, ...analyticsParams });
    }
    if (onClick) onClick(e);
  }

  return (
    <button
      ref={ref}
      {...rest}
      disabled={isDisabled}
      onClick={handleClick}
      className={buildClassName(variant, size, className)}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
});

// ---------- LinkButton ----------

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  StyleProps &
  AnalyticsProps & {
    children?: ReactNode;
  };

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  {
    variant = "primary",
    size = "md",
    className,
    onClick,
    analyticsId,
    analyticsEvent = "cta_click",
    analyticsParams,
    children,
    ...rest
  },
  ref
) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    track(analyticsEvent, { event_label: analyticsId, ...analyticsParams });
    if (onClick) onClick(e);
  }

  return (
    <a
      ref={ref}
      {...rest}
      onClick={handleClick}
      className={buildClassName(variant, size, className)}
    >
      {children}
    </a>
  );
});
