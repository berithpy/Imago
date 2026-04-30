import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldError } from "@/client/components/ErrorMessage";
import { useTenant } from "@/client/lib/tenantContext";

const inputLargeClass =
  "w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 text-base outline-none";

export function AdminSetup() {
  const navigate = useNavigate();
  const { routeBase } = useTenant();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/tenant/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, recoveryEmail: recoveryEmail || undefined }),
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setDone(true);
        setTimeout(() => navigate(routeBase ? `${routeBase}/login` : "/login"), 2000);
      } else {
        setError(data.error ?? "Setup failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-amber-400 text-lg">
          + Admin account created. Redirecting to login...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-7 py-8">
          <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-neutral-500 mb-5 mt-0">
            Imago
          </p>

          <h1 className="text-[1.4rem] font-bold mb-2 mt-0">Admin Setup</h1>
          <p className="text-neutral-500 text-sm mb-6 mt-0">
            Create the admin account. This can only be done once.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
              className={inputLargeClass}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className={inputLargeClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              required
              minLength={8}
              className={inputLargeClass}
            />
            <input
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="Recovery email (optional, defaults to admin email)"
              className={inputLargeClass}
            />

            {error && <FieldError message={error} />}

            <button
              type="submit"
              disabled={loading}
              className={`w-full px-4 py-3 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-base cursor-pointer ${loading ? "opacity-70" : ""}`}
            >
              {loading ? "Creating..." : "Create Admin Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
