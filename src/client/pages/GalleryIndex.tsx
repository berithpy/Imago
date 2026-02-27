import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { EmptyState } from "@/client/components/EmptyState";

type Gallery = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: number;
  banner_photo_id: string | null;
  event_date: number | null;
  expires_at: number | null;
  created_at: number;
};

export function GalleryIndex() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setLoading(true);
    fetch("/api/galleries")
      .then((r) => r.json() as Promise<{ galleries: Gallery[] }>)
      .then((data) => setGalleries(data.galleries ?? []))
      .catch(() => setError("Failed to load galleries"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>Imago</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 40 }}>
        Select a gallery to view
      </p>

      {loading && <SpinnerOverlay />}
      {error && <ErrorMessage message={error} onRetry={load} />}

      {!loading && !error && galleries.length === 0 && (
        <EmptyState message="No galleries yet." />
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {galleries.map((g) => (
            <Link
              key={g.id}
              to={g.is_public ? `/gallery/${g.slug}` : `/gallery/${g.slug}/login`}
              style={{
                display: "block",
                padding: "20px 24px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                color: "var(--color-text)",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>{g.name}</span>
                {g.is_public ? (
                  <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 4, background: "var(--color-accent)", color: "#0f0f0f", fontWeight: 600 }}>PUBLIC</span>
                ) : null}
              </div>
              {g.description && (
                <div style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: "0.9rem" }}>
                  {g.description}
                </div>
              )}
              {g.event_date && (
                <div style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: "0.85rem" }}>
                  📅 {new Date(g.event_date * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <div style={{ marginTop: 48, borderTop: "1px solid var(--color-border)", paddingTop: 24 }}>
        <Link to="/admin/login" style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
          Admin
        </Link>
      </div>
    </div>
  );
}
