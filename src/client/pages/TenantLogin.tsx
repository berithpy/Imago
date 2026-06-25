import { useSearchParams } from "react-router-dom";
import { LoginCard } from "@/client/components/LoginCard";
import { useTenant } from "@/client/lib/tenantContext";
import { useAuth } from "@/client/lib/authContext";
import { AuthCheckBoundary, resolveSessionRedirect } from "@/client/lib/authGate";
import { getPostLoginRedirect } from "@/client/lib/authRedirect";

export function TenantLogin() {
  const { auth, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const { routeBase } = useTenant();
  const redirectTarget = getPostLoginRedirect(searchParams);

  const errorCode = searchParams.get("error");
  const errorMessage =
    errorCode === "not-authorized"
      ? "Your account is not authorized to access the admin panel."
      : null;
  const decision = resolveSessionRedirect({
    auth,
    loading,
    errorCode,
    redirectTo: redirectTarget ?? `${routeBase}/manage`,
  });

  async function handleMagicLink(email: string) {
    const res = await fetch("/api/viewer/admin/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Failed to send link");
    }
  }

  return (
    <AuthCheckBoundary decision={decision}>
      <div>
        {errorMessage && (
          <div
            role="alert"
            className="max-w-[420px] mx-auto mt-6 px-4 py-3 bg-red-400/10 border border-red-400/40 rounded-lg text-red-400 text-sm text-center"
          >
            {errorMessage}
          </div>
        )}
        <LoginCard
          title="Admin"
          subtitle="Sign in to manage galleries and photos."
          onMagicLink={handleMagicLink}
        />
      </div>
    </AuthCheckBoundary>
  );
}
