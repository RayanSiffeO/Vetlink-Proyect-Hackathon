import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VetLink · SPA. En desarrollo `/api` se proxya a la API FastAPI local.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
