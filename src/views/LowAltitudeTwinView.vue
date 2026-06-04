<template>
  <div class="lat-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 顶部标题条 -->
    <div class="top-bar">
      <span class="title">低空气象数字孪生平台</span>
      <span class="subtitle">气象感知 · 数字孪生 · XR 可视化 · AI 飞行决策</span>
    </div>

    <LowAltitudeTwinControlPanel
      :scenario="twin.scenario.value"
      :wind-speed="twin.windSpeed.value"
      :wind-direction="twin.windDirection.value"
      :visibility="twin.visibility.value"
      :corridor-altitude="twin.corridorAltitude.value"
      :drone-flying="twin.droneFlying.value"
      :drone-progress="twin.droneProgress.value"
      :xr-mode="twin.xrMode.value"
      :follow-drone="twin.followDrone.value"
      :show-buildings="twin.showBuildings.value"
      :show-wind="twin.showWind.value"
      :show-rain="twin.showRain.value"
      :show-fog="twin.showFog.value"
      :show-turbulence="twin.showTurbulence.value"
      :show-corridor="twin.showCorridor.value"
      :show-drone="twin.showDrone.value"
      :analyzing="twin.analyzing.value"
      :decision="twin.aiDecision.value"
      @switch-scenario="twin.switchScenario($event)"
      @set-altitude="twin.setCorridorAltitude($event)"
      @toggle-drone-flight="twin.toggleDroneFlight()"
      @set-progress="twin.setDroneProgress($event)"
      @toggle-xr="twin.toggleXR()"
      @toggle-follow="twin.toggleFollowDrone()"
      @toggle-layer="twin.toggleLayer($event)"
      @run-analysis="twin.runAIAnalysis()"
      @adopt-altitude="twin.adoptSuggestedAltitude()"
      @fly-to="twin.flyToScene()"
    />

    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在构建低空数字孪生场景…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import LowAltitudeTwinControlPanel from '@/components/LowAltitudeTwinControlPanel.vue'
import { useLowAltitudeTwin } from '@/composables/useLowAltitudeTwin'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const twin = useLowAltitudeTwin(viewer)

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

    isReady.value = true
    twin.init()
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  twin.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.lat-view {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.top-bar {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 10px 18px;
  background: rgba(10, 16, 32, 0.85);
  border: 1px solid rgba(90, 209, 255, 0.25);
  border-radius: 10px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .title {
    font-size: 17px;
    font-weight: 700;
    color: #5ad1ff;
    text-shadow: 0 0 10px rgba(90, 209, 255, 0.3);
  }

  .subtitle {
    font-size: 11px;
    color: #8fb4cc;
    letter-spacing: 0.5px;
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 16, 32, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
  color: #5ad1ff;

  p {
    margin-top: 16px;
    font-size: 16px;
  }
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(90, 209, 255, 0.15);
  border-top-color: #5ad1ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
