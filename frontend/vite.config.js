import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 300,
    },
    // Tiempo real en desarrollo: /ws va al servicio realtime (uvicorn), igual que en
    // producción lo hace nginx; así el frontend usa la misma dirección en ambos
    // ("realtime" es el servicio de docker-compose.dev.yml).
    proxy: {
      '/ws': {
        target: 'http://realtime:8001',
        ws: true,
      },
    },
  },
})
