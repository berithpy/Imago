import { useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { useAuth } from "@/client/lib/authContext";
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = getPostLoginRedirect(searchParams);

  useEffect(() => {
    if (loading) return;

    if (!auth) {
      navigate("/login", { replace: true });
      return;
    }
    if (redirectTarget) {
      navigate(redirectTarget, { replace: true });
      return;
    }
    if (auth.superAdmin) {
      navigate("/operator", { replace: true });
      return;
    }
    if (auth.memberships.length === 1) {
      navigate(`/${auth.memberships[0].tenantSlug}/manage`, { replace: true });
      return;
    }
    if (auth.memberships.length === 0) {
      navigate("/login?error=not-authorized", { replace: true });
    }
    // multi-tenant: fall through to chooser render
  }, [auth, loading, navigate, redirectTarget]);

  if (loading || !auth || auth.superAdmin || auth.memberships.length < 2) {
    return <SpinnerOverlay label="Signing you in..." />;
  }

  return (
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
          {auth.memberships.map((m) => (
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
  );
}
