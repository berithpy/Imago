# Imago – Work Plan

---

## Feature 1 – Photo Card Overlays (filename + index badge)

### Goal
Add two non-intrusive informational overlays to each masonry thumbnail card in `GalleryView`:

1. **Bottom-left** — the original filename (e.g. `img2319.jpg`)
2. **Top-right** — the photo's position in the full set (e.g. `1 / 48`)

Both should use a web-safe monospace font (`'Courier New', Courier, monospace`) so they feel like metadata/data labels rather than UI chrome.

---

### Sub-task 1a – Pass index and total down to `PhotoCard` / `PhotoThumbnail`

**Files:** `src/client/pages/GalleryView.tsx`, `src/client/components/PhotoThumbnail.tsx`

**Changes:**
- Masonic's render function already receives an `index` prop on `PhotoCard`. Expose it.
- Store `photos.length` (total loaded so far) and pass it via the `_ctx` static property alongside the existing `onClick` handler.
- Add two optional props to `PhotoThumbnailProps`:
  - `index?: number` — 1-based position
  - `total?: number` — total photos in the set
  - `filename?: string` — derived from `photo.original_name`
- These props are only used in `fit="full-width"` mode (the masonry viewer). The admin `fit="cover"` tiles remain unchanged.

**Notes:**
- Because Masonic only knows about the _loaded_ slice, `total` will reflect the count of currently-fetched photos. This is acceptable; if a full count endpoint is added later, the prop can be wired to it without component changes.

---

### Sub-task 1b – Render the overlays inside `PhotoThumbnail`

**File:** `src/client/components/PhotoThumbnail.tsx`

**Changes:**
- Inside the `full-width` branch, after the `<img>`, render two absolutely-positioned `<span>` elements:
  - **Filename badge** — bottom-left, semi-transparent dark pill, monospace, small font, truncated with `text-overflow: ellipsis` so long names don't overflow.
  - **Index badge** — top-right, same pill style, `index / total` text.
- Both badges sit at `z-index: 2` above the image.
- Style approach: inline styles only (consistent with the rest of the file, no CSS modules).
- Shared pill style:
  ```
  background: rgba(0,0,0,0.55)
  color: #fff
  font-family: 'Courier New', Courier, monospace
  font-size: 11px
  line-height: 1.4
  padding: 2px 6px
  border-radius: 3px
  pointer-events: none          ← so clicks pass through to the card
  user-select: none
  white-space: nowrap
  ```
- Filename badge additional styles: `bottom: 8px; left: 8px; maxWidth: calc(100% - 16px); overflow: hidden; textOverflow: ellipsis`
- Index badge additional styles: `top: 8px; right: 8px`
- Both badges only render when the image has loaded (`loaded === true`) so they don't flash over the skeleton.

---

## Feature 2 – Single-photo Download Button in Lightbox

### Goal
When a visitor opens a photo in the lightbox, show a **Download** button that triggers a browser download of the full-resolution image without navigating away.

---

### Sub-task 2a – Extend `LightboxProps` and add download logic

**File:** `src/client/components/Lightbox.tsx`

**Changes:**
- Add an optional `filename?: string` prop (falls back to the `r2Key` basename if omitted).
- Add a `handleDownload` async function inside the component:
  1. `fetch` the image URL (`/api/images/${r2Key}?variant=full`) with `credentials: "include"` so the viewer JWT cookie is sent.
  2. Convert the response to a `Blob`.
  3. Create a temporary object URL, attach it to an `<a>` with the `download` attribute set to the filename, click it programmatically, then revoke the URL.
- This approach works regardless of CORS/auth because the fetch is same-origin and the cookie is included.

---

### Sub-task 2b – Render the Download button

**File:** `src/client/components/Lightbox.tsx`

**Changes:**
- Add a `<button>` (or `<a>`) positioned at `bottom: 20px; right: 24px` (mirroring the close button placement at top-right) — or alternatively grouped with the close button in a top bar.
- Suggested placement: **bottom-center**, so it's clearly discoverable but doesn't crowd the close ×.
- Label: `⬇ Download` with an accessible `aria-label="Download photo"`.
- Style: pill/ghost button consistent with the existing close button aesthetic (white text, no background, subtle border, monospace or system font).
- Prevent the click from bubbling to the backdrop `onClose` handler via `e.stopPropagation()`.

---

### Sub-task 2c – Wire filename through from `GalleryView`

**File:** `src/client/pages/GalleryView.tsx`

**Changes:**
- The `lightbox` state already holds a `Photo` object which includes `original_name`.
- Pass `filename={lightbox.original_name}` to `<Lightbox>` where it is rendered.

---

## Implementation Order

1. Feature 1a → 1b (card overlays — self-contained, no API changes)
2. Feature 2a → 2b → 2c (download button — touches Lightbox + GalleryView only)
