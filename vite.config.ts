import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ ones) so existing usage of GEMINI_API_KEY stays compatible
  const env = loadEnv(mode, process.cwd(), '');

  // Use a repo-relative base in production (for GitHub Pages).
  // You can override via VITE_BASE in a .env.production file if needed.
  const base = mode === 'production' ? (env.VITE_BASE || '/Sysadmin-App/') : '/';

  return {
    base,
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // Preserve the existing define usage but fall back safely if env vars are missing
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      // Stable hashed asset names and a small default config suitable for GitHub Pages
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  };
});
