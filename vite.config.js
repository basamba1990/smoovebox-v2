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
  optimizeDeps: {
    include: ['uuid'],
  },
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
      external: [/^react-icons\/fi/],
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: true,
    host: '0.0.0.0',
    allowedHosts: ["https://smoovebox-v2.vercel.app", "smoovebox-*-v2-samba-bas-projects.vercel.app", "5173-ia44f8gbv6a2gpc18pdjh-0ec895f8.manus.computer"]
  },
});
