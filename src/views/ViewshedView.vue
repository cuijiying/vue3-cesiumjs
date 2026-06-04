<template>
  <div class="viewshed-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <ViewshedControlPanel
      :is-visible="viewshed.isVisible.value"
      :show-frustum="viewshed.showFrustum.value"
      :opacity="viewshed.opacity.value"
      :visible-color="viewshed.visibleColor.value"
      :current-preset="viewshed.currentPreset.value"
      :result="viewshed.result.value"
      @toggle-visibility="viewshed.toggleVisibility()"
      @toggle-frustum="viewshed.toggleFrustum()"
      @set-opacity="viewshed.setOpacity($event)"
      @set-visible-color="viewshed.setVisibleColor($event)"
      @switch-preset="viewshed.switchPreset($event)"
      @fly-to="viewshed.flyToObserver()"
      @re-analyze="viewshed.runAnalysis()"
    />

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady || viewshed.isLoading.value">
      <div class="loading-spinner"></div>
      <p>正在执行可视域分析...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import ViewshedControlPanel from '@/components/ViewshedControlPanel.vue'
import { useViewshed } from '@/composables/useViewshed'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const viewshed = useViewshed(viewer)

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
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(116.397, 39.908, 5000),
      orientation: {
        heading: Cesium.Math.toRadians(45),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })

    isReady.value = true

    // 执行初始分析
    viewshed.runAnalysis()
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  viewshed.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.viewshed-view {
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
  border-top: 4px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
