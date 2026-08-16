import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      build: {
        target: 'esnext'
      },
      // GEMINI_API_KEY is intentionally NOT exposed here — all AI calls go through
      // the backend proxy (backend/routes/ai.ts) so the key never reaches the browser bundle.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
