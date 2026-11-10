// Builds the self-contained live preview (one HTML file, sample data, no backend):
//   npm run build:demo   →  dist-demo/index.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('true') },
  build: { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 },
});
