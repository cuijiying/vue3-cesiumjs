<template>
  <div class="flood-analysis-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <FloodAnalysisControlPanel
      :is-visible="flood.isVisible.value"
      :water-level="flood.waterLevel.value"
      :water-opacity="flood.waterOpacity.value"
      :water-color="flood.waterColor.value"
      :current-preset="flood.currentPreset.value"
      :flood-stats="flood.floodStats.value"
      :is-animating="flood.isAnimating.value"
      :show-terrain="flood.showTerrain.value"
      :min-elev="flood.terrainData.value?.minElev ?? 0"
      :max-elev="flood.terrainData.value?.maxElev ?? 100"
      @toggle-visibility="flood.toggleVisibility()"
      @toggle-terrain="flood.toggleTerrain()"
      @set-water-level="flood.setWaterLevel($event)"
      @set-water-opacity="flood.setWaterOpacity($event)"
      @set-water-color="flood.setWaterColor($event)"
      @load-preset="loadPreset($event)"
      @start-animation="flood.startAnimation()"
      @stop-animation="flood.stopAnimation()"
      @fly-to="flood.flyToLayer()"
    />

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady || flood.isLoading.value">
      <div class="loading-spinner"></div>
      <p>正在加载淹没分析...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import FloodAnalysisControlPanel from '@/components/FloodAnalysisControlPanel.vue'
import { useFloodAnalysis } from '@/composables/useFloodAnalysis'
import { FLOOD_PRESETS } from '@/data/floodData'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const flood = useFloodAnalysis(viewer)

function initViewer() {
  try {
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
    })

    const creditContainer = viewer.value.cesiumWidget.creditContainer as HTMLElement
    if (creditContainer) {
      creditContainer.style.display = 'none'
    }

    viewer.value.scene.globe.depthTestAgainstTerrain = false

    // 初始视角
    const preset = FLOOD_PRESETS[0]!
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        preset.center.lon,
        preset.center.lat,
        preset.center.height,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })

    isReady.value = true

    // 加载默认场景
    flood.loadPreset(0)
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

function loadPreset(index: number) {
  flood.loadPreset(index)
  flood.flyToLayer()
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  flood.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.flood-analysis-view {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: #fff;

  p {
    margin-top: 16px;
    font-size: 16px;
  }
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
