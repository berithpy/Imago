import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { createAuthClient } from "better-auth/client";
import { LoginCard } from "@/client/components/LoginCard";

const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth` });

export function GalleryLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [galleryName, setGalleryName] = useState<string | null>(null);
  const [bypassing, setBypassing] = useState(false);
  const [checking, setChecking] = useState(true);

  const fallbackPath = `/gallery/${slug}`;
  const requestedNext = new URLSearchParams(location.search).get("next") ?? "";
  const safeNextPath =
    requestedNext.startsWith(fallbackPath) && !requestedNext.startsWith("//")
      ? requestedNext
      : fallbackPath;

  useEffect(() => {
    fetch(`/api/galleries/${slug}`)
      .then((r) => r.ok ? r.json() as Promise<{ gallery?: { id: string; name: string; is_public: number } }> : null)
      .then((d) => {
        if (d?.gallery?.id) setGalleryId(d.gallery.id);
        if (d?.gallery?.name) setGalleryName(d.gallery.name);
        setChecking(false);
      })
      .catch(() => { setChecking(false); });

    authClient.getSession({ fetchOptions: { credentials: "include" } })
      .then(({ data }) => { if (data?.session) setIsAdmin(true); })
      .catch(() => { });
  }, [slug]);

  async function handleAdminBypass() {
    if (!galleryId) return;
    setBypassing(true);
    try {
      const res = await fetch(`/api/admin/galleries/${galleryId}/viewer-bypass`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        navigate(safeNextPath, { replace: true });
      } else {
        throw new Error("Admin bypass failed. Are you still logged in?");
      }
    } finally {
      setBypassing(false);
    }
  }

  async function handleMagicLink(email: string) {
    const res = await fetch(`/api/viewer/gallery/${slug}/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, callbackPath: safeNextPath }),
    });
    if (!res.ok) {
      const data = await res.json() as { error?: string };
      throw new Error(
        data.error === "Email not on access list"
          ? "This email doesn't have access to this gallery."
          : (data.error ?? "Failed to send link")
      );
    }
  }

  async function handlePassword(password: string) {
    const res = await fetch(`/api/viewer/gallery/${slug}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      navigate(safeNextPath, { replace: true });
    } else {
      const data = await res.json() as { error?: string };
      throw new Error(data.error ?? "Incorrect password");
    }
  }

  if (checking) return null;

  return (
    <LoginCard
      title={galleryName ?? "this gallery"}
      subtitle="Enter your email to receive a one-time sign-in link."
      showPasswordFallback
      showAdminBypass={isAdmin && !!galleryId}
      bypassLoading={bypassing}
      onMagicLink={handleMagicLink}
      onPassword={handlePassword}
      onAdminBypass={handleAdminBypass}
    />
  );
}
