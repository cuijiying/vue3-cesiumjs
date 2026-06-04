<template>
  <div class="wind-field-3d-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <WindField3DControlPanel
      :is-visible="wind.isVisible.value"
      :particle-count="wind.particleCount.value"
      :speed-factor="wind.speedFactor.value"
      :fade-opacity="wind.fadeOpacity.value"
      :line-width="wind.lineWidth.value"
      :height-scale="wind.heightScale.value"
      :color-scale="wind.colorScale.value"
      :wind-data="wind.windData.value"
      :visible-levels="wind.visibleLevels.value"
      @toggle-visibility="wind.toggleVisibility()"
      @set-particle-count="wind.setParticleCount($event)"
      @set-speed-factor="wind.setSpeedFactor($event)"
      @set-fade-opacity="wind.setFadeOpacity($event)"
      @set-line-width="wind.setLineWidth($event)"
      @set-height-scale="wind.setHeightScale($event)"
      @set-color-scale="wind.setColorScale($event)"
      @toggle-level="wind.toggleLevel($event)"
      @fly-to="wind.flyToLayer()"
      @reload="reload()"
    />

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady || wind.isLoading.value">
      <div class="loading-spinner"></div>
      <p>正在加载三维风场图层...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import WindField3DControlPanel from '@/components/WindField3DControlPanel.vue'
import { useWindField3D } from '@/composables/useWindField3D'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const wind = useWindField3D(viewer)

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

    // 开启深度检测和地球透明（便于观察地下无遮挡）
    viewer.value.scene.globe.depthTestAgainstTerrain = false

    // 初始视角：斜 45° 俯视中国
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(104.06, 21.0, 6000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })

    isReady.value = true

    // 初始化三维风场
    wind.loadData(36, 36)
    const container = document.getElementById('cesiumContainer')!
    wind.setupCanvas(container)
    wind.startAnimation()
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

function reload() {
  wind.stopAnimation()
  wind.loadData(36, 36)
  wind.startAnimation()
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  wind.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.wind-field-3d-view {
  position: relative;
  width: 100%;
  height: 100vh;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;

  p {
    color: #fff;
    font-size: 16px;
    margin-top: 16px;
  }
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
