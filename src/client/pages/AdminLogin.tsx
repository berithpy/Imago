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

  // If SuperAdminDashboard signed us out because we lacked super-admin,
  // it appended ?error=not-authorized so we can explain the rejection
  // instead of silently bouncing the user (which previously caused a
  // /admin → /admin/login → /admin loop).
  const errorCode = searchParams.get("error");
  const errorMessage =
    errorCode === "not-authorized"
      ? "Your account is not authorized to access the admin panel."
      : null;

  useEffect(() => {
    // If we landed here with an error, do not auto-redirect on an existing
    // session — that would re-trigger the loop the error is trying to break.
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
          style={{
            maxWidth: 420,
            margin: "24px auto 0",
            padding: "12px 16px",
            background: "rgba(224, 92, 92, 0.12)",
            border: "1px solid rgba(224, 92, 92, 0.4)",
            borderRadius: 8,
            color: "#e05c5c",
            fontSize: "0.9rem",
            textAlign: "center",
          }}
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