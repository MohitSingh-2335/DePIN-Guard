import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // THE REVERSE PROXY CONFIGURATION
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Forward to Python Backend
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
