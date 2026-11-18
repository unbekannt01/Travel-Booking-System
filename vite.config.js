import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/react/') || id.includes('\\react\\') || id.includes('/react-dom/') || id.includes('\\react-dom\\') || id.includes('/scheduler/') || id.includes('\\scheduler\\')) {
            return 'vendor-react'
          }
          if (id.includes('recharts') || id.includes('victory-vendor') || id.includes('d3-') || id.includes('decimal.js-light') || id.includes('react-smooth')) {
            return 'vendor-recharts'
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }
          if (id.includes('qrcode') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'vendor-ui'
          }
          return 'vendor-misc'
        },
      },
    },
  },
})
