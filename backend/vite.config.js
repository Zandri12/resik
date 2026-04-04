import path from 'path'
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/js/main.tsx'],
      refresh: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'resources/js'),
    },
  },
  optimizeDeps: {
    include: ['ckeditor5', '@ckeditor/ckeditor5-react'],
  },
  server: {
    watch: {
      ignored: ['**/storage/framework/views/**'],
    },
  },
  build: {
    /** Default 500 kB; main bundle ~3 MB — naikkan agar build tidak memunculkan peringatan chunk besar. */
    chunkSizeWarningLimit: 3500,
  },
})
