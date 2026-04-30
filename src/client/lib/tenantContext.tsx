import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useParams, Outlet } from "react-router-dom";

export type TenantContextValue = {
  tenantSlug: string | null;
  tenantName: string | null;
  /** API base: "/api/t/{slug}" in tenant context, "/api" otherwise */
  apiBase: string;
  /** Route base: "/t/{slug}" in tenant context, "" otherwise */
  routeBase: string;
};

const TenantContext = createContext<TenantContextValue>({
  tenantSlug: null,
  tenantName: null,
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
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      setTenantName(null);
      return;
    }

    let cancelled = false;
    setTenantName(null);
    fetch(`/api/t/${tenantSlug}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ tenant?: { name?: string } }>;
      })
      .then((data) => {
        if (!cancelled) setTenantName(data?.tenant?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setTenantName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const value: TenantContextValue = useMemo(() => tenantSlug
    ? {
      tenantSlug,
      tenantName,
      apiBase: `/api/t/${tenantSlug}`,
      routeBase: `/${tenantSlug}`,
    }
    : { tenantSlug: null, tenantName: null, apiBase: "/api", routeBase: "" },
    [tenantSlug, tenantName]
  );

  return (
    <TenantContext.Provider value={value}>
      <Outlet />
    </TenantContext.Provider>
  );
}
