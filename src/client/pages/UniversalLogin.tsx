import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { LoginCard } from "@/client/components/LoginCard";
import { SpinnerOverlay } from "@/client/components/Spinner";

const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
});

export function UniversalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checkingSession, setCheckingSession] = useState(true);

  const errorCode = searchParams.get("error");
  const errorMessage =
    errorCode === "not-authorized"
      ? "Your account is not authorized for any admin or operator dashboard."
      : null;

  useEffect(() => {
    if (errorCode) {
      setCheckingSession(false);
      return;
    }
    authClient
      .getSession({ fetchOptions: { credentials: "include" } })
      .then((res: any) => {
        if (res?.data?.session) navigate("/login/resolve", { replace: true });
      })
      .catch(() => { })
      .finally(() => setCheckingSession(false));
  }, [navigate, errorCode]);

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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SpinnerOverlay />
      </div>
    );
  }

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
        title="Sign in to Imago"
        subtitle="Enter your email and we'll send you a sign-in link."
        onMagicLink={handleMagicLink}
      />
    </div>
  );
}
