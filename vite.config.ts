import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";

// Build identifier injected into the bundle and exposed via /version.json
// so the client can detect when a new deployment is live and force a reload
// instead of running on stale chunks.
const BUILD_ID =
  process.env.VITE_BUILD_ID ||
  process.env.COMMIT_REF ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  String(Date.now());

function buildVersionPlugin(): Plugin {
  return {
    name: "medikong-build-version",
    apply: "build",
    closeBundle() {
      try {
        const outDir = path.resolve(__dirname, "dist");
        if (!fs.existsSync(outDir)) return;
        const payload = JSON.stringify(
          { buildId: BUILD_ID, builtAt: new Date().toISOString() },
          null,
          2,
        );
        fs.writeFileSync(path.join(outDir, "version.json"), payload, "utf8");
      } catch {
        // best-effort, never break the build
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    chunkSizeWarningLimit: 1200,
    // Vite hashes assets by default (file.[hash].js) — keep that explicit
    // so old chunks coexist briefly with new ones during a redeploy.
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    buildVersionPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
