import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project site: https://cuijiying.github.io/vue3-cesiumjs/
  // Local/dev keeps '/'. CI sets VITE_BASE=/vue3-cesiumjs/
  base: process.env.VITE_BASE || '/',
  plugins: [
    vue(),
    vueDevTools(),
    cesium(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
