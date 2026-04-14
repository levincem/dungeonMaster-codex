import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^three$/,
        replacement: fileURLToPath(new URL('./src/vendor/three-compat.ts', import.meta.url)),
      },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (normalizedId.includes('/node_modules/')) {
            if (
              normalizedId.includes('/react/') ||
              normalizedId.includes('/react-dom/') ||
              normalizedId.includes('/scheduler/')
            ) {
              return 'react-vendor'
            }

            if (
              normalizedId.includes('/three/') ||
              normalizedId.includes('/photons2/')
            ) {
              return 'three-core'
            }

            if (normalizedId.includes('/@react-three/')) {
              return 'three-r3f'
            }

            if (
              normalizedId.includes('/framer-motion/') ||
              normalizedId.includes('/lucide-react/')
            ) {
              return 'ui-vendor'
            }

            return 'vendor'
          }

          if (
            normalizedId.includes('/src/assets/data/dungeon.json')
          ) {
            return 'dungeon-blob'
          }

          if (
            normalizedId.includes('/src/assets/data/game_db.json')
          ) {
            return 'game-db-blob'
          }

          if (
            normalizedId.includes('/src/assets/data/') ||
            normalizedId.includes('/src/data/dungeonData.ts') ||
            normalizedId.includes('/src/data/gameDbData.ts') ||
            normalizedId.includes('/src/data/mapLoader.ts')
          ) {
            return 'boot-data'
          }

          if (
            normalizedId.includes('/src/data/items.ts') ||
            normalizedId.includes('/src/data/itemImages.ts') ||
            normalizedId.includes('/src/data/waterContainers.ts') ||
            normalizedId.includes('/src/data/weaponAttacks.ts')
          ) {
            return 'item-data'
          }

          if (
            normalizedId.includes('/src/data/runes.ts') ||
            normalizedId.includes('/src/data/originalSpells.ts') ||
            normalizedId.includes('/src/data/spells.ts') ||
            normalizedId.includes('/src/data/spellRuntime.ts')
          ) {
            return 'magic-data'
          }

          if (normalizedId.includes('/src/data/assetPaths.ts')) {
            return 'asset-runtime'
          }

          if (
            normalizedId.includes('/src/assets/original_wall_overlay_positions.json') ||
            normalizedId.includes('/src/data/originalWallOverlays.ts')
          ) {
            return 'overlay-data'
          }

          if (
            normalizedId.includes('/src/data/champions.ts') ||
            normalizedId.includes('/src/data/championsRuntime.ts') ||
            normalizedId.includes('/src/data/championStarterItems.ts') ||
            normalizedId.includes('/src/data/creatures.ts') ||
            normalizedId.includes('/src/data/creaturesRuntime.ts') ||
            normalizedId.includes('/src/data/mechanisms.ts') ||
            normalizedId.includes('/src/data/equipment.ts') ||
            normalizedId.includes('/src/data/doors.ts')
          ) {
            return 'world-data'
          }

          if (
            normalizedId.includes('/src/engine/saveGame.ts') ||
            normalizedId.includes('/src/engine/sounds.ts')
          ) {
            return 'game-core'
          }

          if (normalizedId.includes('/src/components/Dungeon/')) {
            return 'dungeon-render'
          }
        },
      },
    },
  },
})
