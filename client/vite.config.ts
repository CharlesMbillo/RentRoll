import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      "@assets": path.resolve(__dirname, "../attached_assets"),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // GitHub Pages serves from root or /docs, so we need relative paths
    base: './',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
})