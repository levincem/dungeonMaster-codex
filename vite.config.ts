import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (normalizedId.includes('/node_modules/')) {
            if (
              normalizedId.includes('/three/') ||
              normalizedId.includes('/@react-three/')
            ) {
              return 'three-vendor'
            }

            return 'vendor'
          }

          if (normalizedId.includes('/src/engine/store.ts')) {
            return 'game-core'
          }
        },
      },
    },
  },
})
