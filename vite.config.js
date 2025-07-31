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
          openai: ["openai"],
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
    allowedHosts: ["smoovebox-v2-ok9i3pfat-samba-bas-projects.vercel.app", "smoovebox-v2-git-main-samba-bas-projects.vercel.app", "smoovebox-v2-samba-bas-projects.vercel.app", "https://smoovebox-v2.vercel.app", "smoovebox-*-v2-samba-bas-projects.vercel.app", "5173-i8wktuhtg6hd8ws2xry0r-dded83f9.manusvm.computer", "5173-in3r2nr2ki5dwrk1kwubp-0fe9f55f.manusvm.computer"],
  },
});

