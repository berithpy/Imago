import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { LoginCard } from "@/client/components/LoginCard";
import { useTenant } from "@/client/lib/tenantContext";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
});

export function AdminLogin() {
  const navigate = useNavigate();
  const { routeBase } = useTenant();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    authClient
      .getSession({ fetchOptions: { credentials: "include" } })
      .then((res: any) => {
        if (res?.data?.session) navigate(`${routeBase}/admin`, { replace: true });
      })
      .catch(() => { })
      .finally(() => setCheckingSession(false));
  }, [navigate]);

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
    <LoginCard
      title="Admin"
      subtitle="Sign in to manage galleries and photos."
      onMagicLink={handleMagicLink}
    />
  );
}