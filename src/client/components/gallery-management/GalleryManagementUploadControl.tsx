import { useRef, useState } from "react";
import { accentButtonStyle } from "@/client/components/ui";

type Props = {
  galleryId: string;
  onUploadComplete: () => void;
  buttonLabel?: string;
};

export function GalleryManagementUploadControl({
  galleryId,
  onUploadComplete,
  buttonLabel = "+ Upload photos",
}: Props) {
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
        await fetch(`/api/admin/galleries/${galleryId}/photos`, {
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
        style={{ display: "none" }}
        id={inputId}
      />
      <label
        htmlFor={inputId}
        style={{
          ...accentButtonStyle,
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {uploading ? uploadProgress : buttonLabel}
      </label>
      {uploading && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            padding: "14px 20px",
            fontSize: "0.9rem",
            color: "var(--color-accent)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
        >
          {uploadProgress}
        </div>
      )}
    </>
  );
}
