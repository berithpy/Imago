import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Single source of truth for the static link-preview metadata in index.html.
// Per-gallery URLs override these tags at the edge (see
// src/worker/routes/ogPreview.ts).
const SITE_META = {
  SITE_NAME: "Imago",
  SITE_DESCRIPTION: "Hosted photo galleries.",
  SITE_DESCRIPTION_LONG: "Imago — hosted photo galleries",
  SITE_OG_IMAGE: "/og-default.png",
};

function siteMetaHtmlPlugin() {
  return {
    name: "imago-site-meta-html",
    transformIndexHtml(html: string) {
      return html.replace(/%(SITE_[A-Z_]+)%/g, (_match, key) => {
        const value = SITE_META[key as keyof typeof SITE_META];
        if (value === undefined) {
          throw new Error(`Unknown site meta placeholder: %${key}%`);
        }
        return value;
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), siteMetaHtmlPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
