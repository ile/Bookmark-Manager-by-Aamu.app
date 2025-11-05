// vite.config.js
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    minify: false,
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/manager.jsx',  // ← changed to .jsx
      output: {
        entryFileNames: 'manager.js',  // ← output still .js
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"development"'
  }
});