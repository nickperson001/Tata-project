import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const frontendDir = path.resolve(__dirname, 'src/frontend');

export default defineConfig({
  root: frontendDir,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(frontendDir, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'public/dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          charts: ['chart.js', 'react-chartjs-2'],
          scanner: ['html5-qrcode'],
        },
      },
    },
  },
});
