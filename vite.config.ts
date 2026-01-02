import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        allowedHosts: true, // Allows any URL/host to access the app
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://backend:3001', // 'backend' is the docker service name
            changeOrigin: true,
          },
          '/images': {
            target: 'http://backend:3001',
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});