import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Saat dev, /api (cookie httpOnly satu origin) dan /uploads (foto profil, poster) diteruskan ke API lokal.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4200',
      '/uploads': 'http://localhost:4200',
    },
  },
})
