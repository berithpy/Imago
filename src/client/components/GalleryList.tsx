import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmationModal } from "@/client/components/ConfirmationModal";
import { SpinnerOverlay } from "@/client/components/Spinner";
import { ErrorMessage } from "@/client/components/ErrorMessage";
import { EmptyState } from "@/client/components/EmptyState";
import { PhotoThumbnail } from "@/client/components/PhotoThumbnail";
import { useTenant } from "@/client/lib/tenantContext";

type Gallery = {
  id: string;
  name: string;
  slug: string;
  is_public: number;
  description: string | null;
  banner_r2_key: string | null;
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
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    action: () => Promise<void>;
  }>(null);

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
    setBusy(g.id);
    try { await onSoftDelete(g.id); load(); } finally { setBusy(null); }
  }

  async function handleRestore(g: Gallery) {
    setBusy(g.id);
    try { await onRestore(g.id); load(); } finally { setBusy(null); }
  }

  async function handlePermanentDelete(g: Gallery) {
    setBusy(g.id);
    try { await onPermanentDelete(g.id); load(); } finally { setBusy(null); }
  }

  async function handleConfirmation() {
    if (!confirmation) return;
    setConfirming(true);
    try {
      await confirmation.action();
      setConfirmation(null);
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <SpinnerOverlay />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const active = galleries.filter((g) => !g.deleted_at);
  const deleted = galleries.filter((g) => g.deleted_at);
  const renderThumbnail = (gallery: Gallery) => (
    <div className="w-20 shrink-0">
      {gallery.banner_r2_key ? (
        <PhotoThumbnail r2Key={gallery.banner_r2_key} alt={gallery.name} fit="cover" />
      ) : (
        <div className="aspect-square rounded-md border border-dashed border-neutral-800 bg-neutral-950" />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {active.length === 0 ? (
        <EmptyState message="No galleries yet." />
      ) : (
        active.map((g) => (
          <div
            key={g.id}
            className="flex justify-between gap-4 px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-lg"
          >
            <div className="flex items-center gap-4 min-w-0">
              {renderThumbnail(g)}
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
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Link
                to={`${routeBase}/${g.slug}/edit`}
                className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm"
              >
                Manage
              </Link>
              <button
                onClick={() =>
                  setConfirmation({
                    title: `Hide "${g.name}"?`,
                    description: "This gallery will be hidden from viewers until you restore it.",
                    confirmLabel: "Hide gallery",
                    action: () => handleSoftDelete(g),
                  })
                }
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
                className="flex justify-between gap-4 px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-lg opacity-55"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {renderThumbnail(g)}
                  <div className="min-w-0">
                    <span className="text-neutral-100 font-semibold">{g.name}</span>
                    <span className="text-neutral-500 text-sm ml-2">/{g.slug}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRestore(g)}
                    disabled={busy === g.id}
                    className="px-4 py-2 bg-transparent border border-neutral-800 rounded-lg text-neutral-500 text-sm cursor-pointer disabled:opacity-50"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      setConfirmation({
                        title: `Delete "${g.name}" forever?`,
                        description: "This permanently removes the gallery and all of its photos.",
                        confirmLabel: "Delete forever",
                        action: () => handlePermanentDelete(g),
                      })
                    }
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
      <ConfirmationModal
        open={!!confirmation}
        title={confirmation?.title ?? ""}
        description={confirmation?.description ?? ""}
        confirmLabel={confirmation?.confirmLabel ?? "Confirm"}
        loading={confirming}
        onCancel={() => {
          if (!confirming) setConfirmation(null);
        }}
        onConfirm={handleConfirmation}
      />
    </div>
  );
}