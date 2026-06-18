import { useRef, useState } from "react";
import { useTenant } from "@/client/lib/tenantContext";

type Props = {
  galleryId: string;
  onUploadComplete: () => void;
  buttonLabel?: string;
};

export function UploadControl({
  galleryId,
  onUploadComplete,
  buttonLabel = "+ Upload photos",
}: Props) {
  const { apiBase } = useTenant();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1} / ${files.length}: ${file.name}`);
        const fd = new FormData();
        fd.append("file", file);
        await fetch(`${apiBase}/admin/galleries/${galleryId}/photos`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });
      }
      onUploadComplete();
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const inputId = `upload-input-${galleryId}`;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id={inputId}
      />
      <label
        htmlFor={inputId}
        className={`inline-block px-4 py-2 bg-amber-400 border-0 rounded-lg text-neutral-950 font-semibold text-sm whitespace-nowrap ${uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          }`}
      >
        {uploading ? uploadProgress : buttonLabel}
      </label>
      {uploading && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-amber-400 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
          {uploadProgress}
        </div>
      )}
    </>
  );
}
