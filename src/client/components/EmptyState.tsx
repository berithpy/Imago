import type { ReactNode } from "react";

type Props = {
  message: string;
  action?: ReactNode;
};

export function EmptyState({ message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center text-neutral-500">
      <p className="text-sm">{message}</p>
      {action}
    </div>
  );
}