import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        sidebar: resolve(__dirname, "sidebar.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        "content/youtube-music": resolve(
          __dirname,
          "src/content/youtube-music.ts"
        ),
        "content/spotify": resolve(__dirname, "src/content/spotify.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        // Keep content scripts self-contained (no dynamic imports)
        manualChunks(id) {
          if (id.includes("node_modules/react")) {
            return "chunks/react-vendor";
          }
        },
      },
    },
  },
  publicDir: "public",
});
