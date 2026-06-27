import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { useAuth } from "@/client/lib/authContext";
import {
  buildNav,
  buildOperatorSettingsNav,
  buildTenantSettingsNav,
  type NavScope,
} from "@/client/lib/navConfig";
import { useTenant } from "@/client/lib/tenantContext";
import { TopBar } from "./TopBar";
import { MobileDrawer } from "./MobileDrawer";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
});

export type AppShellProps = {
  children: ReactNode;
  /**
   * Override the gallery slug used for nav scoping. Most pages can omit
   * this and rely on URL params; the gallery viewer/editor pages provide
   * it explicitly because the URL pattern is `:tenantSlug/:gallerySlug/*`.
   */
  gallerySlug?: string;
};

/**
 * Top-level chrome wrapping every authenticated/unauthenticated page that
 * wants the standard navigation. Reads tenant + gallery slug from the URL,
 * computes the visible nav items via `buildNav`, and renders the desktop
 * top bar plus a mobile drawer.
 */
export function AppShell({ children, gallerySlug }: AppShellProps) {
  const { auth, refresh, clearHint } = useAuth();
  const { tenantName } = useTenant();
  const params = useParams<{ tenantSlug?: string; gallerySlug?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ctx = useMemo(
    () => ({
      tenantSlug: params.tenantSlug,
      tenantName: tenantName ?? undefined,
      gallerySlug: gallerySlug ?? params.gallerySlug,
    }),
    [params.tenantSlug, tenantName, params.gallerySlug, gallerySlug]
  );

  const items = useMemo(() => buildNav(auth, ctx), [auth, ctx]);
  const tenantSettingsItems = useMemo(
    () => buildTenantSettingsNav(auth, ctx),
    [auth, ctx]
  );
  const operatorSettingsItems = useMemo(() => buildOperatorSettingsNav(auth), [auth]);

  // Active membership = the one matching the current tenant slug; falls
  // back to the first membership for the role display in the user menu.
  const activeMembership = useMemo(() => {
    if (!auth) return null;
    if (ctx.tenantSlug) {
      const m = auth.memberships.find((x) => x.tenantSlug === ctx.tenantSlug);
      if (m) return m;
    }
    return auth.memberships[0] ?? null;
  }, [auth, ctx.tenantSlug]);

  async function handleSignOut() {
    await authClient.signOut({ fetchOptions: { credentials: "include" } });
    clearHint();
    await refresh();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        items={items}
        tenantSettingsItems={tenantSettingsItems}
        operatorSettingsItems={operatorSettingsItems}
        currentPath={location.pathname}
        user={auth?.user ?? null}
        superAdmin={auth?.superAdmin ?? false}
        roleDisplay={activeMembership?.roleDisplay ?? null}
        onMenuClick={() => setDrawerOpen(true)}
        onSignOut={handleSignOut}
      />
      <MobileDrawer
        open={drawerOpen}
        items={items}
        tenantSettingsItems={tenantSettingsItems}
        operatorSettingsItems={operatorSettingsItems}
        currentPath={location.pathname}
        onClose={() => setDrawerOpen(false)}
        onSignOut={auth ? handleSignOut : undefined}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

/** Re-export for convenience in pages. */
export type { NavScope };
export { Link };
