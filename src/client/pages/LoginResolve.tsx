import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { SpinnerOverlay } from "@/client/components/Spinner";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
});

type Resolution = {
  superAdmin: boolean;
  tenants: Array<{ slug: string; name: string }>;
};

export function LoginResolve() {
  const navigate = useNavigate();
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/login/resolve", { credentials: "include" });
      if (cancelled) return;

      if (res.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      if (!res.ok) {
        setError("Could not load your sign-in destinations. Please try again.");
        return;
      }

      const data = (await res.json()) as Resolution;

      if (data.superAdmin) {
        navigate("/operator", { replace: true });
        return;
      }
      if (data.tenants.length === 1) {
        navigate(`/${data.tenants[0].slug}/manage`, { replace: true });
        return;
      }
      if (data.tenants.length === 0) {
        await authClient.signOut({ fetchOptions: { credentials: "include" } });
        navigate("/login?error=not-authorized", { replace: true });
        return;
      }
      // Multi-tenant: render chooser
      setResolution(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!resolution) return <SpinnerOverlay label="Signing you in..." />;

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
          {resolution.tenants.map((t) => (
            <li key={t.slug}>
              <Link
                to={`/${t.slug}/manage`}
                className="block px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 hover:border-amber-400 transition-colors"
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-neutral-500 text-xs mt-0.5">/{t.slug}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
