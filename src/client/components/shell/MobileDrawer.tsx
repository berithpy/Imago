import { useEffect } from "react";
import { Link } from "react-router-dom";
import { isNavItemActive, type NavItem } from "@/client/lib/navConfig";

export type MobileDrawerProps = {
  open: boolean;
  items: NavItem[];
  tenantSettingsItems: NavItem[];
  operatorSettingsItems: NavItem[];
  currentPath: string;
  onClose: () => void;
  /** Omit when unauthenticated. */
  onSignOut?: () => void;
};

const sectionHeadingClass =
  "px-3 pt-4 pb-1 text-[0.68rem] uppercase tracking-[0.12em] text-neutral-600 font-semibold";

function linkClass(active: boolean): string {
  return `px-3 py-2.5 rounded-md text-sm ${active
    ? "text-amber-400 bg-neutral-900"
    : "text-neutral-300"
    }`;
}

/**
 * Slide-out nav drawer for small screens. Closes when the user picks a
 * link or taps the backdrop.
 */
export function MobileDrawer({
  open,
  items,
  tenantSettingsItems,
  operatorSettingsItems,
  currentPath,
  onClose,
  onSignOut,
}: MobileDrawerProps) {
  const settingsMenuItems = [...operatorSettingsItems, ...tenantSettingsItems];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        onClick={onClose}
        aria-label="Close menu"
        className="absolute inset-0 bg-black/60 cursor-default"
      />
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-[78%] max-w-[320px] bg-neutral-950 border-l border-neutral-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <span className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-neutral-300">
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-neutral-800 text-neutral-400 cursor-pointer"
          >
            X
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">
          {items.length === 0 && settingsMenuItems.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-500">No actions available.</p>
          )}
          {items.map((item) => {
            const active = isNavItemActive(currentPath, item);
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={onClose}
                className={linkClass(active)}
              >
                {item.label}
              </Link>
            );
          })}

          {settingsMenuItems.length > 0 && (
            <>
              <div className={sectionHeadingClass}>Settings</div>
              {settingsMenuItems.map((item) => {
                const active = isNavItemActive(currentPath, item);
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={onClose}
                    className={linkClass(active)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {onSignOut && (
          <div className="border-t border-neutral-800 p-3">
            <button
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full px-3 py-2 bg-transparent border border-neutral-800 rounded-md text-neutral-400 text-sm cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
