import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { cardStyle, ghostButtonStyle, dangerButtonStyle } from "@/client/components/ui";

export type Gallery = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: number;
  banner_photo_id: string | null;
  event_date: number | null;
  expires_at: number | null;
  deleted_at: number | null;
  created_at: number;
};

type SortKey = "created_desc" | "created_asc" | "name_asc" | "name_desc" | "event_desc" | "event_asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "event_desc", label: "Event date ↓" },
  { value: "event_asc", label: "Event date ↑" },
];

interface GalleryListProps {
  refreshKey?: number;
  onSoftDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
}

export function GalleryList({ refreshKey = 0, onSoftDelete, onRestore, onPermanentDelete }: GalleryListProps) {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("created_desc");

  // Debounce search input by 300 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (q: string, s: SortKey) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: s });
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/galleries?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json() as { galleries: Gallery[] };
      setGalleries(data.galleries ?? []);
      setTotal((prev) => q ? prev : (data.galleries?.length ?? 0));
    } catch (err) {
      console.error("Failed to load galleries", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(debouncedSearch, sort);
  }, [debouncedSearch, sort, load, refreshKey]);

  async function runAction(id: string, action: () => Promise<void>) {
    setActionInProgress(id);
    try {
      await action();
    } finally {
      setActionInProgress(null);
      load(debouncedSearch, sort);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Search by title, slug or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: "0.9rem",
            cursor: "pointer",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", padding: "16px 0" }}>Loading…</p>
      ) : galleries.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "var(--color-text-muted)", padding: "16px 0" }}>
          {debouncedSearch ? `No galleries match "${debouncedSearch}".` : "No galleries yet."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {galleries.map((g) => (
            <GalleryListItem
              key={g.id}
              gallery={g}
              actionInProgress={actionInProgress}
              onSoftDelete={(id, name) => runAction(id, () => onSoftDelete(id))}
              onRestore={(id) => runAction(id, () => onRestore(id))}
              onPermanentDelete={(id, name) => runAction(id, () => onPermanentDelete(id))}
            />
          ))}
        </div>
      )}

      {debouncedSearch && !loading && galleries.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 8 }}>
          {galleries.length} of {total} galleries
        </p>
      )}
    </div>
  );
}

interface GalleryListItemProps {
  gallery: Gallery;
  actionInProgress: string | null;
  onSoftDelete: (id: string, name: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string, name: string) => void;
}

function GalleryListItem({ gallery: g, actionInProgress, onSoftDelete, onRestore, onPermanentDelete }: GalleryListItemProps) {
  const now = Date.now();

  return (
    <div
      style={{
        ...cardStyle,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: g.deleted_at ? 0.55 : 1,
      }}
    >
      <Link
        to={`/admin/galleries/${g.id}`}
        style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
      >
        {/* Title + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{g.name}</span>
          {g.is_public ? (
            <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 4, background: "var(--color-accent)", color: "#0f0f0f", fontWeight: 600 }}>PUBLIC</span>
          ) : null}
          {g.deleted_at ? (
            <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: 4, background: "var(--color-border)", color: "var(--color-text-muted)", fontWeight: 600 }}>HIDDEN</span>
          ) : null}
        </div>

        {/* Slug */}
        <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>/{g.slug}</div>

        {/* Description */}
        {g.description ? (
          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {g.description}
          </div>
        ) : null}

        {/* Dates row */}
        <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Created {new Date(g.created_at * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
          </span>
          {g.event_date ? (
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              📅 {new Date(g.event_date * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </span>
          ) : null}
          {g.expires_at ? (
            <span style={{ fontSize: "0.75rem", color: g.expires_at * 1000 < now ? "var(--color-error)" : "var(--color-text-muted)" }}>
              ⏳ Expires {new Date(g.expires_at * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </span>
          ) : null}
        </div>
      </Link>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {g.deleted_at ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(g.id); }}
              disabled={actionInProgress === g.id}
              style={{ ...ghostButtonStyle, fontSize: "0.85rem" }}
            >Restore</button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Permanently delete "${g.name}" and ALL its photos? This cannot be undone.`))
                  onPermanentDelete(g.id, g.name);
              }}
              disabled={actionInProgress === g.id}
              style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}
            >Delete forever</button>
          </>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Hide gallery "${g.name}" from viewers? You can restore it later.`))
                onSoftDelete(g.id, g.name);
            }}
            disabled={actionInProgress === g.id}
            style={{ ...dangerButtonStyle, fontSize: "0.85rem" }}
          >Hide</button>
        )}
      </div>
    </div>
  );
}
