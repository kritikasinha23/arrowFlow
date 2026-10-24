import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Public tunnel: https://t3.qooq.space/<port> keeps the /<port> path prefix. */
const PORT = 5173;
const BASE = `/${PORT}/`;
const PUBLIC_HOST = "t3.qooq.space";

export default defineConfig({
  base: BASE,
  plugins: [react()],
  resolve: {
    alias: {
      "@arrowflow/twine": path.resolve(__dirname, "../../packages/twine/src/index.ts"),
      "@arrowflow/renderer": path.resolve(__dirname, "../../packages/renderer/src/index.ts"),
      "@arrowflow/engine": path.resolve(__dirname, "src/engine-bridge.ts"),
      "@arrowflow/levels": path.resolve(__dirname, "src/levels-shim.ts"),
    },
  },
  server: {
    host: true,
    port: PORT,
    strictPort: true,
    allowedHosts: [PUBLIC_HOST, `.${PUBLIC_HOST.split(".").slice(-2).join(".")}`, "localhost"],
    hmr: {
      protocol: "wss",
      host: PUBLIC_HOST,
      clientPort: 443,
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
