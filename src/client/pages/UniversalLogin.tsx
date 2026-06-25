import { useSearchParams } from "react-router-dom";
import { LoginCard } from "@/client/components/LoginCard";
import { useAuth } from "@/client/lib/authContext";
import { AuthCheckBoundary, resolveSessionRedirect } from "@/client/lib/authGate";
import { getPostLoginRedirect } from "@/client/lib/authRedirect";

export function UniversalLogin() {
  const { auth, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTarget = getPostLoginRedirect(searchParams);

  const errorCode = searchParams.get("error");
  const errorMessage =
    errorCode === "not-authorized"
      ? "Your account is not authorized for any admin or operator dashboard."
      : null;
  const decision = resolveSessionRedirect({
    auth,
    loading,
    errorCode,
    redirectTo: redirectTarget
      ? `/login/resolve?returnTo=${encodeURIComponent(redirectTarget)}`
      : "/login/resolve",
  });

  async function handleMagicLink(email: string) {
    const res = await fetch("/api/login/magic-link", {
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
          title="Sign in to Imago"
          subtitle="Enter your email and we'll send you a sign-in link."
          onMagicLink={handleMagicLink}
        />
      </div>
    </AuthCheckBoundary>
  );
}
