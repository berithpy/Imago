import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/client/components/shell/AppShell";
import { AuthCheckBoundary, useAuthCheck } from "@/client/lib/authGate";

type Tenant = {
  id: string;
  deleted_at: number | null;
};

type User = {
  id: string;
  is_super_admin: number;
};

type DashboardStats = {
  activeTenants: number;
  deletedTenants: number;
  operatorUsers: number;
};

const statCardClass = "bg-neutral-900 border border-neutral-800 rounded-lg px-5 py-4";
const quickLinkClass =
  "inline-block px-4 py-2 border border-neutral-800 rounded-lg text-sm text-neutral-300 hover:text-neutral-100";

export function OperatorDashboard() {
  const authCheck = useAuthCheck({
    role: "super-admin",
    loginPath: "/login",
    returnTo: "/operator",
    unauthorizedTo: "/login?error=not-authorized",
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeTenants: 0,
    deletedTenants: 0,
    operatorUsers: 0,
  });

  useEffect(() => {
    if (authCheck.outcome !== "allowed") {
      return;
    }
    setStatsLoading(true);

    Promise.all([
      fetch("/api/operator/tenants", { credentials: "include" }).then(
        (r) => r.json() as Promise<{ tenants: Tenant[] }>
      ),
      fetch("/api/tenant/users", { credentials: "include" }).then(
        (r) => r.json() as Promise<{ users: User[] }>
      ),
    ])
      .then(([tenantsData, usersData]) => {
        const tenants = tenantsData.tenants ?? [];
        const users = usersData.users ?? [];
        setStats({
          activeTenants: tenants.filter((t) => !t.deleted_at).length,
          deletedTenants: tenants.filter((t) => !!t.deleted_at).length,
          operatorUsers: users.filter((u) => !!u.is_super_admin).length,
        });
      })
      .catch(() => {
        setStats({ activeTenants: 0, deletedTenants: 0, operatorUsers: 0 });
      })
      .finally(() => setStatsLoading(false));
  }, [authCheck.outcome]);

  return (
    <AuthCheckBoundary decision={authCheck}>
      <AppShell>
        <div className="max-w-[960px] mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-bold">Welcome, operator</h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              Use the platform navigation to manage tenants and operator users.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-[1.1rem] font-semibold mb-3">Platform Snapshot</h2>
            {statsLoading ? (
              <p className="text-neutral-500 text-sm">Loading stats...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={statCardClass}>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide">Active Tenants</p>
                  <p className="text-2xl font-semibold mt-1">{stats.activeTenants}</p>
                </div>
                <div className={statCardClass}>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide">Deleted Tenants</p>
                  <p className="text-2xl font-semibold mt-1">{stats.deletedTenants}</p>
                </div>
                <div className={statCardClass}>
                  <p className="text-neutral-500 text-xs uppercase tracking-wide">Operator Users</p>
                  <p className="text-2xl font-semibold mt-1">{stats.operatorUsers}</p>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[1.1rem] font-semibold mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link to="/operator/tenants" className={quickLinkClass}>Go to Tenants</Link>
              <Link to="/operator/users" className={quickLinkClass}>Go to Users</Link>
            </div>
          </section>
        </div>
      </AppShell>
    </AuthCheckBoundary>
  );
}
