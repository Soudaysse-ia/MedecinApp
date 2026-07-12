import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le port est assigne par l'hote (variable PORT) quand il est disponible ;
// sinon on retombe sur 5180 pour un lancement manuel en local.
const PORT = process.env.PORT ? Number(process.env.PORT) : 5180;

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    host: true,        // accessible depuis le telephone sur le meme reseau wifi
    // Proxy des appels API vers le backend Express
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
