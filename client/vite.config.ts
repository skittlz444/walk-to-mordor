import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      // Required for React-compatible libraries (e.g. Konva ecosystem)
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  build: {
    outDir: '../public/js/client',
    emptyOutDir: true,
    rolldownOptions: {
      input: './src/index.tsx',
      output: {
        entryFileNames: 'islands.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        // Use predictable name for CSS (no hash) for server-rendered HTML linking
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'islands.css';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
  },
});
