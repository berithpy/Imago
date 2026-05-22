import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isNavItemActive, type NavItem } from "@/client/lib/navConfig";
import type { AuthUser } from "@/client/lib/authContext";

export type TopBarProps = {
  items: NavItem[];
  tenantSettingsItems: NavItem[];
  operatorSettingsItems: NavItem[];
  currentPath: string;
  user: AuthUser | null;
  superAdmin: boolean;
  /** Role label for the active tenant (e.g. "Account owner"). */
  roleDisplay: string | null;
  onMenuClick: () => void;
  onSignOut: () => void;
};

type OpenMenu = "settings" | null;

const menuPanelClass =
  "absolute right-0 top-full mt-2 min-w-[210px] rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl shadow-black/40 p-1 z-50";
const menuLinkClass =
  "block px-3 py-2 rounded-md text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-900";
const activeMenuLinkClass = "text-amber-400 bg-neutral-900";

/**
 * Desktop top bar. Renders the brand, primary nav items, and the user
 * menu. On small screens the nav collapses into a hamburger that opens
 * the `MobileDrawer`.
 */
export function TopBar({
  items,
  tenantSettingsItems,
  operatorSettingsItems,
  currentPath,
  user,
  superAdmin,
  roleDisplay,
  onMenuClick,
  onSignOut,
}: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuItems = [...operatorSettingsItems, ...tenantSettingsItems];

  useEffect(() => {
    if (!openMenu) return;

    function onPointerDown(e: PointerEvent) {
      if (!menuRootRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-6">
        <Link
          to="/"
          className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-neutral-300"
        >
          Imago
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {items.map((item) => {
            const active = isNavItemActive(currentPath, item);
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${active
                  ? "text-amber-400 bg-neutral-900"
                  : "text-neutral-400 hover:text-neutral-100"
                  }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        {/* User block */}
        <div ref={menuRootRef} className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden md:block relative">
                <div className="flex flex-col items-end leading-tight">
                  <span className="text-sm text-neutral-200">{user.name || user.email}</span>
                  <span className="text-[0.7rem] text-neutral-500">
                    {superAdmin ? "Imago operator" : roleDisplay ?? user.email}
                  </span>
                </div>
              </div>
              {settingsMenuItems.length > 0 && (
                <div className="hidden md:block relative">
                  <button
                    onClick={() => setOpenMenu((value) => value === "settings" ? null : "settings")}
                    aria-label="Open account settings menu"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === "settings"}
                    className="inline-flex items-center justify-center w-9 h-9 bg-transparent border border-neutral-800 rounded-md text-neutral-400 cursor-pointer hover:text-neutral-100"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1.82.33H22a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
                    </svg>
                  </button>
                  {openMenu === "settings" && (
                    <div role="menu" className={menuPanelClass}>
                      {settingsMenuItems.map((item) => {
                        const active = isNavItemActive(currentPath, item);
                        return (
                          <Link
                            key={item.id}
                            to={item.to}
                            role="menuitem"
                            onClick={() => setOpenMenu(null)}
                            className={`${menuLinkClass} ${active ? activeMenuLinkClass : ""}`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={onSignOut}
                className="hidden md:inline-block px-3 py-1.5 bg-transparent border border-neutral-800 rounded-md text-neutral-400 text-sm cursor-pointer hover:text-neutral-100"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-block px-3 py-1.5 bg-amber-400 border-0 rounded-md text-neutral-950 font-semibold text-sm"
            >
              Sign in
            </Link>
          )}

          {/* Hamburger (mobile only) */}
          <button
            onClick={onMenuClick}
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-neutral-800 text-neutral-300 cursor-pointer"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
