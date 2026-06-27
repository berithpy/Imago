import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/client/lib/authContext";
import { AuthCheckBoundary, resolveLoginResolveDecision } from "@/client/lib/authGate";
import { getPostLoginRedirect } from "@/client/lib/authRedirect";

/**
 * Post-login destination resolver. Reads the cached `/api/me` state and
 * routes the user to the highest-privilege dashboard available:
 *
 *   - Imago operator -> /operator
 *   - exactly one tenant membership -> /{slug}/manage
 *   - multiple tenants -> render the chooser
 *   - no memberships and not an operator -> /login?error=not-authorized
 *   - unauthenticated -> /login
 */
export function LoginResolve() {
  const { auth, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTarget = getPostLoginRedirect(searchParams);
  const decision = resolveLoginResolveDecision({ auth, loading, redirectTarget });

  return (
    <AuthCheckBoundary decision={decision}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] bg-neutral-900 border border-neutral-800 rounded-lg px-10 py-12">
          <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-neutral-500 mb-5">
            Imago
          </p>
          <h1 className="text-[1.4rem] font-bold mb-2">Choose a tenant</h1>
          <p className="text-neutral-500 text-sm mb-6">
            You have access to multiple tenants. Pick one to continue.
          </p>
          <ul className="flex flex-col gap-2">
            {auth?.memberships.map((m) => (
              <li key={m.tenantSlug}>
                <Link
                  to={`/${m.tenantSlug}/manage`}
                  className="block px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 hover:border-amber-400 transition-colors"
                >
                  <div className="font-semibold">{m.tenantName}</div>
                  <div className="text-neutral-500 text-xs mt-0.5">
                    /{m.tenantSlug} - {m.roleDisplay}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AuthCheckBoundary>
  );
}
