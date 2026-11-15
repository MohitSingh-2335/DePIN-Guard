import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const BACKEND_URL = env.VITE_API_URL || 'http://localhost:8000';
  const WS_BACKEND  = BACKEND_URL.replace(/^https?/, 'ws');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/login': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/signup': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/profile': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/verify': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/logout': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/refresh': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: WS_BACKEND,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});