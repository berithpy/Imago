import { Zip, ZipPassThrough } from "fflate";

type ExportPhoto = { name: string; url: string };

/**
 * Fetches all photos, zips them in-browser with fflate, then triggers a
 * normal browser anchor download — the browser's own download bar appears
 * with the filename and an "Open" / "Show in folder" option.
 *
 * @param galleryName  Used as the zip file name.
 * @param photos       Array of { name, url } objects from the export endpoint.
 * @param onProgress   Called with (downloaded, total) counts after each photo.
 */
export async function exportGallery(
  galleryName: string,
  photos: ExportPhoto[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  if (photos.length === 0) return;

  const safeGalleryName = galleryName.replace(/[^a-z0-9_\-. ]/gi, "_");
  const fileName = `${safeGalleryName}.zip`;

  // Deduplicate file names (append _2, _3, … as needed)
  const nameCounts = new Map<string, number>();
  const uniquePhotos = photos.map((p) => {
    const ext = p.name.includes(".") ? p.name.slice(p.name.lastIndexOf(".")) : "";
    const base = p.name.includes(".") ? p.name.slice(0, p.name.lastIndexOf(".")) : p.name;
    const count = (nameCounts.get(p.name) ?? 0) + 1;
    nameCounts.set(p.name, count);
    return { ...p, name: count === 1 ? p.name : `${base}_${count}${ext}` };
  });

  // Build zip in memory, then trigger a standard anchor download.
  // The browser's download bar handles the "open / show in folder" UX.
  const chunks: Uint8Array[] = [];

  await new Promise<void>((resolve, reject) => {
    const zip = new Zip((err, data, final) => {
      if (err) { reject(err); return; }
      chunks.push(data);
      if (final) resolve();
    });

    (async () => {
      for (let i = 0; i < uniquePhotos.length; i++) {
        const { name, url } = uniquePhotos[i];
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok || !res.body) throw new Error(`Failed to fetch ${name}`);

        const entry = new ZipPassThrough(name);
        zip.add(entry);

        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) { entry.push(new Uint8Array(0), true); break; }
          entry.push(value);
        }

        onProgress?.(i + 1, uniquePhotos.length);
      }
      zip.end();
    })().catch(reject);
  });

  const blob = new Blob(chunks as unknown as BlobPart[], { type: "application/zip" });
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
}
