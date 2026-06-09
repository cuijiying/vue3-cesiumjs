<template>
  <div class="tileset-ground-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <div class="control-panel">
      <h3>3D Tiles 图层</h3>
      <p>服务地址:</p>
      <p class="service-url">{{ tilesetUrl }}</p>
      <p>图层状态: {{ tileset ? '已加载' : '未加载' }}</p>
      <button @click="flyToTileset" :disabled="!tileset">定位图层</button>
      <button @click="reloadTileset" :disabled="isLoading">重新加载</button>
      <p v-if="loadError" class="error-text">{{ loadError }}</p>
    </div>

    <div class="loading-overlay" v-if="!isReady || isLoading">
      <div class="loading-spinner"></div>
      <p>正在加载 3D Tiles 图层...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import * as Cesium from 'cesium'

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
if (ionToken) {
  Cesium.Ion.defaultAccessToken = ionToken
}

// http://localhost:8080/3dtiles/tileset.json http://localhost/3dtiles/tileset.json
// const defaultTilesetUrl = 'http://localhost:9004/tile/model/service/ob0ngbYN/tileset.json'
// const defaultTilesetUrl = 'http://localhost:8080/3dtiles/tileset.json'
const defaultTilesetUrl = 'http://localhost/3dtiles/tileset.json'
const envTilesetUrl = (import.meta.env.VITE_3DTILES_URL as string | undefined)?.trim()
const tilesetUrl = envTilesetUrl || defaultTilesetUrl

const viewer = shallowRef<Cesium.Viewer | null>(null)
const tileset = shallowRef<Cesium.Cesium3DTileset | null>(null)
const isReady = ref(false)
const isLoading = ref(false)
const loadError = ref('')

function initViewer() {
  viewer.value = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    vrButton: false,
    shouldAnimate: true,
    terrain: Cesium.Terrain.fromWorldTerrain(),
  })

  viewer.value.scene.globe.depthTestAgainstTerrain = true

  const creditContainer = viewer.value.cesiumWidget.creditContainer as HTMLElement
  if (creditContainer) {
    creditContainer.style.display = 'none'
  }

  isReady.value = true
}


function flyToTileset() {
  if (!viewer.value || !tileset.value) return

  const radius = Math.max(tileset.value.boundingSphere.radius, 200)
  viewer.value.flyTo(tileset.value, {
    offset: new Cesium.HeadingPitchRange(0, -0.45, radius * 2.2),
  })
}

async function loadTileset() {
  if (!viewer.value) return

  isLoading.value = true
  loadError.value = ''

  try {
    if (tileset.value) {
      viewer.value.scene.primitives.remove(tileset.value)
      tileset.value = null
    }

    const loadedTileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl, {
      maximumScreenSpaceError: 8,
      skipLevelOfDetail: true,
      preferLeaves: true,
    })

    const activeTileset = viewer.value.scene.primitives.add(loadedTileset)
    tileset.value = activeTileset

    flyToTileset()
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    loadError.value = `3D Tiles 加载失败: ${message}`
    console.error('3D Tiles 加载失败:', error)
  } finally {
    isLoading.value = false
  }
}

function reloadTileset() {
  void loadTileset()
}

onMounted(async () => {
  try {
    initViewer()
    await loadTileset()
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    loadError.value = `Cesium 初始化失败: ${message}`
    console.error('Cesium 初始化失败:', error)
  }
})

onUnmounted(() => {
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.tileset-ground-view {
  width: 100%;
  height: 100%;
  position: relative;

  .cesium-container {
    width: 100%;
    height: 100%;
  }

  .control-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 220px;
    padding: 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    z-index: 20;

    h3 {
      margin: 0 0 4px;
      font-size: 1rem;
      color: #1f2937;
    }

    p {
      margin: 0;
      color: #4b5563;
      font-size: 0.85rem;
    }

    .service-url {
      max-width: 320px;
      word-break: break-all;
      color: #1f2937;
      line-height: 1.35;
    }

    button {
      border: none;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 0.88rem;
      color: #ffffff;
      background: #2563eb;
      cursor: pointer;
      transition: background 0.2s;

      &:hover:not(:disabled) {
        background: #1d4ed8;
      }

      &:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
    }

    .error-text {
      color: #dc2626;
      line-height: 1.35;
    }
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    z-index: 40;

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.35);
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 12px;
    }

    p {
      margin: 0;
      font-size: 1rem;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
