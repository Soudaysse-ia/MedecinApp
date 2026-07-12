import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,        // port fixe (5173 est parfois occupe par d'autres apps)
    strictPort: true,  // echoue plutot que de changer de port en silence
    host: true,        // accessible depuis le telephone sur le meme reseau wifi
    // Proxy des appels API vers le backend Express
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
