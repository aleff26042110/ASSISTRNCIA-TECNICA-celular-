import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "three-engine": ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
