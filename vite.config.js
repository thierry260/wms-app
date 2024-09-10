import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      devOptions: {
        enabled: true, // Enables the service worker in dev mode
        type: "module",
      },
      registerType: "autoUpdate",
      manifest: {
        name: "WMS app",
        short_name: "WMS app",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#2d1eed",
        theme_color: "#2d1eed",
        icons: [
          {
            purpose: "maskable",
            sizes: "144x144",
            src: "/img/icon144_maskable.png",
            type: "image/png",
          },
          {
            purpose: "any",
            sizes: "144x144",
            src: "/img/icon144_rounded.png",
            type: "image/png",
          },
          {
            purpose: "maskable",
            sizes: "512x512",
            src: "/img/icon512_maskable.png",
            type: "image/png",
          },
          {
            purpose: "any",
            sizes: "512x512",
            src: "/img/icon512_rounded.png",
            type: "image/png",
          },
        ],
        screenshots: [
          {
            src: "/img/screenshot-mobile.png",
            sizes: "750x1334",
            type: "image/png",
            form_factor: "narrow",
          },
          {
            src: "/img/screenshot-wide.png",
            sizes: "2560x1440",
            type: "image/png",
            form_factor: "wide",
          },
        ],
      },
    }),
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
