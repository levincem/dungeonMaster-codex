import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Keep Photons2 out of the dev prebundle so its `three` import goes
    // through the same alias/dedupe path as the rest of the app.
    exclude: ['photons2'],
  },
  resolve: {
    dedupe: ['three'],
    alias: [
      {
        find: /^three$/,
        replacement: fileURLToPath(new URL('./src/vendor/three-compat.ts', import.meta.url)),
      },
    ],
  },
  build: {
    // Map data is already split per-level and lazy-loaded. Keep the warning
    // high enough to avoid noise from those intentional JSON-heavy chunks
    // while still catching a meaningful regression above today's largest one.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (normalizedId.includes('/node_modules/')) {
            if (
              normalizedId.includes('/three/')
            ) {
              return 'three-core'
            }

            if (normalizedId.includes('/photons2/')) {
              return 'photons-vendor'
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
            normalizedId.includes('/src/assets/runtime/dungeon/bootstrap.json')
          ) {
            return 'dungeon-bootstrap'
          }

          if (
            normalizedId.includes('/src/assets/runtime/db/game_db_items.json')
          ) {
            return 'game-db-items'
          }

          if (
            normalizedId.includes('/src/assets/runtime/db/game_db_weapon_attacks.json')
          ) {
            return 'game-db-weapon-attacks'
          }

          if (
            normalizedId.includes('/src/assets/runtime/db/game_db_creatures.json')
          ) {
            return 'game-db-creatures'
          }

          if (
            normalizedId.includes('/src/assets/runtime/db/game_db.json')
          ) {
            return 'game-db-legacy'
          }

          if (
            normalizedId.includes('/src/assets/runtime/dungeon/maps/')
          ) {
            return undefined
          }

          if (
            normalizedId.includes('/src/assets/runtime/reference/') ||
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
            return 'runtime-data-core'
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
            normalizedId.includes('/src/assets/runtime/support/original_wall_overlay_positions.json') ||
            normalizedId.includes('/src/data/originalWallOverlays.ts')
          ) {
            return 'overlay-data'
          }

          if (
            normalizedId.includes('/src/data/champions.ts') ||
            normalizedId.includes('/src/data/championStarterItems.ts') ||
            normalizedId.includes('/src/data/creatures.ts') ||
            normalizedId.includes('/src/data/mechanisms.ts') ||
            normalizedId.includes('/src/data/equipment.ts') ||
            normalizedId.includes('/src/data/doors.ts')
          ) {
            return 'runtime-data-core'
          }

          if (
            normalizedId.includes('/src/engine/saveGame.ts') ||
            normalizedId.includes('/src/engine/sounds.ts')
          ) {
            return 'runtime-data-core'
          }

          if (normalizedId.includes('/src/components/Dungeon/PhotonsFireball.tsx')) {
            return 'dungeon-effects'
          }

          if (normalizedId.includes('/src/components/UI/HUD.tsx')) {
            return 'hud-ui'
          }

          if (normalizedId.includes('/src/components/UI/ChampionSheet.tsx')) {
            return 'champion-sheet'
          }

          if (normalizedId.includes('/src/components/UI/MirrorPopup.tsx')) {
            return 'mirror-popup'
          }

          if (normalizedId.includes('/src/components/UI/VictoryScreen.tsx')) {
            return 'victory-screen'
          }

          if (normalizedId.includes('/src/components/Dungeon/')) {
            return 'dungeon-render'
          }
        },
      },
    },
  },
})
