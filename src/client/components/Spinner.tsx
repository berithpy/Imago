import type { CSSProperties } from "react";

interface SpinnerProps {
  size?: number;
  style?: CSSProperties;
}

export function Spinner({ size = 28, style }: SpinnerProps) {
  return (
    <div
      className="border-2 border-neutral-800 border-t-amber-400 rounded-full animate-spin"
      style={{ width: size, height: size, ...style }}
    />
  );
}

export function SpinnerOverlay({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-20 px-6 text-neutral-500 text-sm">
      <Spinner />
      {label}
    </div>
  );
}