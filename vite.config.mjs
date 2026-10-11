import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages and inside a Capacitor app.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
