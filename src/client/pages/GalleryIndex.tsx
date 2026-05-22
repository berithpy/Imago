import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { EmptyState } from "@/client/components/EmptyState";
import { useTenant } from "@/client/lib/tenantContext";
import { AppShell } from "@/client/components/shell/AppShell";

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
  const { apiBase, routeBase } = useTenant();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setLoading(true);
    fetch(`${apiBase}/galleries`)
      .then((r) => r.json() as Promise<{ galleries: Gallery[] }>)
      .then((data) => setGalleries(data.galleries ?? []))
      .catch(() => setError("Failed to load galleries"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <AppShell>
      <div className="max-w-[800px] mx-auto px-6 py-12">
        <h1 className="text-[2rem] font-bold mb-2">Imago</h1>
        <p className="text-neutral-500 mb-10">Select a gallery to view</p>

        {loading && <SpinnerOverlay />}
        {error && <ErrorMessage message={error} onRetry={load} />}

        {!loading && !error && galleries.length === 0 && (
          <EmptyState message="No galleries yet." />
        )}

        {!loading && !error && (
          <div className="flex flex-col gap-3">
            {galleries.map((g) => (
              <Link
                key={g.id}
                to={g.is_public ? `${routeBase}/${g.slug}` : `${routeBase}/${g.slug}/login`}
                className="block px-6 py-5 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 transition-colors hover:border-amber-400"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{g.name}</span>
                  {g.is_public ? (
                    <span className="text-[0.7rem] px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 font-semibold">PUBLIC</span>
                  ) : null}
                </div>
                {g.description && (
                  <div className="text-neutral-500 mt-1 text-sm">{g.description}</div>
                )}
                {g.event_date && (
                  <div className="text-neutral-500 mt-1 text-[0.85rem]">
                    {new Date(g.event_date * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
