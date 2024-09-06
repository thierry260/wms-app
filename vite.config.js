import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import path from "path";

const config = {
  plugins: [sveltekit(), SvelteKitPWA()],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    outDir: "build",
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
};

export default config;
