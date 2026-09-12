import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
