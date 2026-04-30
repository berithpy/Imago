import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { LoginCard } from "@/client/components/LoginCard";
import { useTenant } from "@/client/lib/tenantContext";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
});

export function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { routeBase } = useTenant();
  const [checkingSession, setCheckingSession] = useState(true);

  const errorCode = searchParams.get("error");
  const errorMessage =
    errorCode === "not-authorized"
      ? "Your account is not authorized to access the admin panel."
      : null;

  useEffect(() => {
    if (errorCode) {
      setCheckingSession(false);
      return;
    }
    authClient
      .getSession({ fetchOptions: { credentials: "include" } })
      .then((res: any) => {
        if (res?.data?.session) navigate(`${routeBase}/admin`, { replace: true });
      })
      .catch(() => { })
      .finally(() => setCheckingSession(false));
  }, [navigate, routeBase, errorCode]);

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

  if (checkingSession) return null;

  return (
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
  );
}
