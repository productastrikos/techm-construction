/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Port 5176 is pinned for this PoC (see Construction/CLAUDE.md). strictPort => fail loudly instead of drifting.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  // /api and /ws are proxied to the integration hub (server/, port 4333) so the dev build talks to it without CORS or env
  server: {
    port: 5176,
    strictPort: true,
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:4333', '/ws': { target: 'ws://127.0.0.1:4333', ws: true } },
  },
  preview: { port: 5176, strictPort: true, host: '127.0.0.1' },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // keep the heavy 3D / map / chart libs in their own chunks so the shell loads fast
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@react-three/')) return 'r3f';
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'echarts';
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre';
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'pdf';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 20000,
  },
});
