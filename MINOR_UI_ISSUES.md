# Minor UI Issues

Backlog of small UI/UX improvements, broken into workable items.

---

## 1. Login card — post-submit state

**Goal:** After a user submits their email, make it clear the magic link was sent and to which address.

- [ ] After submit, keep the email input visible but set it to `disabled`.
- [ ] Disable the submit button.
- [ ] Change the subtitle to: _"Check your inbox for the sign-in link. If you still can't log in, contact support."_

**Scope:** `src/client/components/LoginCard.tsx` (client-only, no backend changes).

---

## 2. Gallery list — square thumbnail

**Goal:** Show a thumbnail per gallery instead of identifying galleries by name only.

- [ ] Add a backend endpoint to resolve a gallery's "thumbnail" photo (mirrors the OpenGraph image logic).
  - Prefer the marked/starred thumbnail; fall back to the first photo.
- [ ] Render the thumbnail in a square in the gallery list.

**Scope:** new worker route + `src/client/components/GalleryList.tsx`.
**Depends on:** reuse of existing OpenGraph thumbnail resolution logic.

---

## 3. Gallery management thumbnail — multi-select + controls

**Goal:** Support selecting multiple pictures to run bulk operations on the selection.

### 3a. Thumbnail control layout
- [ ] Make the "delete" button square.
- [ ] Move the star button next to the delete button.
- [ ] Add a select checkbox/button in the top-left corner of each thumbnail.

### 3b. Selection state + bulk actions
- [ ] Track selected pictures in component state.
- [ ] Add "Select all" and "Select none" buttons.
- [ ] Wire bulk operations to act on the current selection only.

### 3c. Keyboard navigation
- [ ] Add a cursor/focus that moves between pictures via arrow keys.
- [ ] Add hotkeys to toggle selection and trigger operations on focused/selected items.

**Scope:** `src/client/components/PhotoThumbnail.tsx`, `src/client/components/gallery-management/`, `src/client/pages/GalleryManagementPage.tsx`.

---

## 4. Gallery management — confirmation modal

**Goal:** Replace native `alert`/`confirm` prompts with a reusable confirmation modal.

- [ ] Build/finish a working confirmation modal component.
- [ ] Use the modal when deleting a picture.
- [ ] Use the modal when hiding an album.
- [ ] Add confirmation to the "public/private" toggle.
- [ ] Decide password handling when switching a gallery to private — likely prompt for a **new** password, since the existing one isn't stored in a readable form.

**Scope:** `src/client/pages/GalleryManagementPage.tsx`, `src/client/components/gallery-management/`, plus worker route for password update on the private toggle.
