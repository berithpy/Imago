import { createContext, useContext } from "react";
import { useParams, Outlet } from "react-router-dom";

export type TenantContextValue = {
  tenantSlug: string | null;
  /** API base: "/api/t/{slug}" in tenant context, "/api" otherwise */
  apiBase: string;
  /** Route base: "/t/{slug}" in tenant context, "" otherwise */
  routeBase: string;
};

const TenantContext = createContext<TenantContextValue>({
  tenantSlug: null,
  apiBase: "/api",
  routeBase: "",
});

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

/**
 * Layout route component: reads :tenantSlug from URL params and provides
 * tenant context to all nested routes via <Outlet />.
 */
export function TenantProvider() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const value: TenantContextValue = tenantSlug
    ? {
      tenantSlug,
      apiBase: `/api/t/${tenantSlug}`,
      routeBase: `/${tenantSlug}`,
    }
    : { tenantSlug: null, apiBase: "/api", routeBase: "" };

  return (
    <TenantContext.Provider value={value}>
      <Outlet />
    </TenantContext.Provider>
  );
}
