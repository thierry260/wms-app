import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

const config = {
  plugins: [sveltekit()],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
};

export default config;