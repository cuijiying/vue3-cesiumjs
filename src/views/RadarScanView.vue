<template>
  <div class="radar-scan-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <RadarScanControlPanel
      :is-animating="radar.isAnimating.value"
      :current-heading="radar.currentHeading.value"
      :speed="radar.speed.value"
      :beam-width="radar.beamWidth.value"
      :radius="radar.radius.value"
      :height="radar.height.value"
      :opacity="radar.opacity.value"
      :scan-color="radar.scanColor.value"
      :trail-length="radar.trailLength.value"
      :ring-count="radar.ringCount.value"
      :show-cone="radar.showCone.value"
      :show-rings="radar.showRings.value"
      :show-targets="radar.showTargets.value"
      :show-trail="radar.showTrail.value"
      :current-preset="radar.currentPreset.value"
      :target-count="targetCount"
      @toggle-animation="radar.toggleAnimation()"
      @toggle-cone="radar.toggleCone()"
      @toggle-rings="radar.toggleRings()"
      @toggle-targets="radar.toggleTargets()"
      @toggle-trail="radar.toggleTrail()"
      @set-speed="radar.setSpeed($event)"
      @set-beam-width="radar.setBeamWidth($event)"
      @set-radius="radar.setRadius($event)"
      @set-height="radar.setHeight($event)"
      @set-opacity="radar.setOpacity($event)"
      @set-trail-length="radar.setTrailLength($event)"
      @set-ring-count="radar.setRingCount($event)"
      @set-color="radar.setColor($event)"
      @switch-preset="radar.switchPreset($event)"
      @fly-to="radar.flyToRadar()"
    />

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在初始化雷达扫描...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import RadarScanControlPanel from '@/components/RadarScanControlPanel.vue'
import { useRadarScan } from '@/composables/useRadarScan'
import { RADAR_PRESETS } from '@/data/radarScan'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const radar = useRadarScan(viewer)

const targetCount = computed(() => {
  const preset = RADAR_PRESETS[radar.currentPreset.value]
  return preset?.targets.length ?? 0
})

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

    // 设置暗色场景风格
    viewer.value.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0f1e')

    isReady.value = true
    radar.init()
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  radar.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.radar-scan-view {
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
  background: rgba(10, 15, 30, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 200;
  color: #00ff88;

  p {
    margin-top: 16px;
    font-size: 16px;
    text-shadow: 0 0 8px rgba(0, 255, 100, 0.3);
  }
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(0, 255, 100, 0.15);
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
