import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { EmptyState } from "@/client/components/EmptyState";
import { useTenant } from "@/client/lib/tenantContext";

type Gallery = {
  id: string;
  name: string;
  slug: string;
  is_public: number;
  description: string | null;
  event_date: number | null;
  expires_at: number | null;
  deleted_at: number | null;
  created_at: number;
};

type Props = {
  refreshKey: number;
  onSoftDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
};

export function GalleryList({ refreshKey, onSoftDelete, onRestore, onPermanentDelete }: Props) {
  const { apiBase, routeBase } = useTenant();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`${apiBase}/admin/galleries?includeDeleted=true`, { credentials: "include" })
      .then((r) => r.ok ? r.json() as Promise<{ galleries: Gallery[] }> : Promise.reject(r))
      .then((data) => setGalleries(data.galleries ?? []))
      .catch(() => setError("Failed to load galleries"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [refreshKey]);

  async function handleSoftDelete(g: Gallery) {
    if (!confirm(`Hide "${g.name}"? You can restore it later.`)) return;
    setBusy(g.id);
    try { await onSoftDelete(g.id); load(); } finally { setBusy(null); }
  }

  async function handleRestore(g: Gallery) {
    setBusy(g.id);
    try { await onRestore(g.id); load(); } finally { setBusy(null); }
  }

  async function handlePermanentDelete(g: Gallery) {
    if (!confirm(`Permanently delete "${g.name}" and ALL its photos? This cannot be undone.`)) return;
    setBusy(g.id);
    try { await onPermanentDelete(g.id); load(); } finally { setBusy(null); }
  }

  if (loading) return <SpinnerOverlay />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const active = galleries.filter((g) => !g.deleted_at);
  const deleted = galleries.filter((g) => g.deleted_at);

  return (
    <div className="flex flex-col gap-2">
      {active.length === 0 ? (
        <EmptyState message="No galleries yet." />
      ) : (
        active.map((g) => (
          <div
            key={g.id}
            className="flex justify-between items-center px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-lg"
          >
            <div className="min-w-0">
              <Link
                to={`${routeBase}/${g.slug}/edit`}
                className="text-neutral-100 font-semibold"
              >
                {g.name}
              </Link>
              <span className="text-neutral-500 text-sm ml-2">/{g.slug}</span>
              {g.is_public ? (
                <span className="ml-1.5 text-[0.7rem] px-1.5 py-0.5 rounded bg-amber-400 text-neutral-950 font-semibold">
                  PUBLIC
                </span>
              ) : null}
              {g.description && <div className="text-neutral-500 text-sm mt-1">{g.description}</div>}
            </div>
            <div className="flex gap-1.5">
              <Link
                to={`${routeBase}/${g.slug}/edit`}
                className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm"
              >
                Manage
              </Link>
              <button
                onClick={() => handleSoftDelete(g)}
                disabled={busy === g.id}
                className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-red-400 text-sm cursor-pointer disabled:opacity-50"
              >
                Hide
              </button>
            </div>
          </div>
        ))
      )}

      {deleted.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-neutral-500 cursor-pointer">
            {deleted.length} hidden galler{deleted.length === 1 ? "y" : "ies"}
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            {deleted.map((g) => (
              <div
                key={g.id}
                className="flex justify-between items-center px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-lg opacity-55"
              >
                <div>
                  <span className="text-neutral-100 font-semibold">{g.name}</span>
                  <span className="text-neutral-500 text-sm ml-2">/{g.slug}</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRestore(g)}
                    disabled={busy === g.id}
                    className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer disabled:opacity-50"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(g)}
                    disabled={busy === g.id}
                    className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-red-400 text-sm cursor-pointer disabled:opacity-50"
                  >
                    Delete forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}