import { useEffect, useState } from "react";
import { AppShell } from "@/client/components/shell/AppShell";
import { AuthCheckBoundary, useAuthCheck } from "@/client/lib/authGate";
import { useDebouncedValue } from "@/client/lib/useDebouncedValue";

type User = {
  id: string;
  name: string;
  email: string;
  is_super_admin: number;
  role?: string | null;
};

function OperatorUsersTable({ users }: { users: User[] }) {
  if (users.length === 0) {
    return <p className="text-neutral-500 text-sm">No operator users found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[0.875rem]">
        <thead>
          <tr className="border-b border-neutral-800 text-left">
            <th className="px-3 py-3 font-semibold text-neutral-500">Name</th>
            <th className="px-3 py-3 font-semibold text-neutral-500">Email</th>
            <th className="px-3 py-3 font-semibold text-neutral-500">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-neutral-800">
              <td className="px-3 py-3">
                {u.name}
                {u.is_super_admin ? (
                  <span className="ml-1.5 text-[0.7rem] px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 font-semibold">
                    SUPER
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-3 text-neutral-500">{u.email}</td>
              <td className="px-3 py-3 text-neutral-500">{u.role ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OperatorUsers() {
  const authCheck = useAuthCheck({
    role: "super-admin",
    loginPath: "/login",
    returnTo: "/operator/users",
    unauthorizedTo: "/login?error=not-authorized",
  });
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [pagination, setPagination] = useState({ page: 1, pageSize, total: 0, totalPages: 1 });
  const [operatorUsers, setOperatorUsers] = useState<User[]>([]);

  useEffect(() => {
    if (authCheck.outcome !== "allowed") {
      return;
    }
    setUsersLoading(true);
    const params = new URLSearchParams({
      q: debouncedSearch,
      page: String(page),
      pageSize: String(pageSize),
      superAdminOnly: "1",
    });
    fetch(`/api/tenant/users?${params.toString()}`, { credentials: "include" })
      .then(
        (r) =>
          r.json() as Promise<{
            users: User[];
            pagination?: { page: number; pageSize: number; total: number; totalPages: number };
          }>
      )
      .then((d) => {
        setOperatorUsers(d.users ?? []);
        if (d.pagination) {
          setPagination(d.pagination);
        }
      })
      .catch(() => setOperatorUsers([]))
      .finally(() => setUsersLoading(false));
  }, [authCheck.outcome, page, pageSize, debouncedSearch]);

  return (
    <AuthCheckBoundary decision={authCheck}>
      <AppShell>
        <div className="max-w-[960px] mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-[1.75rem] font-bold">Operator Users</h1>
            <p className="text-neutral-500 text-sm mt-0.5">Manage platform operator access</p>
          </div>

          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search operator users..."
            className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 text-sm outline-none mb-4"
          />

          {usersLoading ? (
            <p className="text-neutral-500 text-sm">Loading...</p>
          ) : (
            <>
              <OperatorUsersTable users={operatorUsers} />
              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-neutral-500 text-sm">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </AuthCheckBoundary>
  );
}
