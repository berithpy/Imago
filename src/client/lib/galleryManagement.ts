export type Photo = {
  id: string;
  r2_key: string;
  original_name: string;
  size: number;
  uploaded_at: number;
};

export type Gallery = {
  id: string;
  name: string;
  slug: string;
  is_public: number;
  share_preview_enabled: number;
  banner_photo_id: string | null;
  banner_r2_key: string | null;
  event_date: number | null;
  expires_at: number | null;
  deleted_at: number | null;
};

export type AllowedEmail = {
  id: string;
  email: string;
  added_at: number;
};

/** Convert unix timestamp to YYYY-MM-DD for <input type="date"> */
export function toDateInputValue(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

/** Format a unix timestamp as a readable date */
export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Human-readable byte size (B / KB / MB) */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
