import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 is often taken by other local Vite apps; use 5180 for this UI by default.
    port: Number(process.env.VITE_DEV_PORT) || 5180,
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        // Default matches backend `API_PORT=8000` (see backend/README.md).
        target: process.env.VITE_API_PROXY ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
