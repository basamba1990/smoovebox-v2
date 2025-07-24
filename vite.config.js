import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
  },
  envDir: "./",
  base: "/",
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          openai: ['openai'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tabs'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    host: '0.0.0.0',
    allowedHosts: ["5173-ia0l5a0bh8bmangq74uvp-0d1a0436.manusvm.computer", "5173-imjva8fwthw73d8exhtk1-2bff9589.manusvm.computer"],
  },
});
