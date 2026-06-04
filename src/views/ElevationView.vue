<template>
  <div class="elevation-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <ElevationControlPanel
      :is-visible="elevLayer.isVisible.value"
      :opacity="elevLayer.opacity.value"
      :height-scale="elevLayer.heightScale.value"
      :color-scale="elevLayer.colorScale.value"
      :grid-data="elevLayer.gridData.value"
      :query-result="elevLayer.queryResult.value"
      :show-labels="elevLayer.showLabels.value"
      @toggle-visibility="elevLayer.toggleVisibility()"
      @toggle-labels="elevLayer.toggleLabels()"
      @set-opacity="elevLayer.setOpacity($event)"
      @set-height-scale="elevLayer.setHeightScale($event)"
      @set-color-scale="elevLayer.setColorScale($event)"
      @fly-to="elevLayer.flyToLayer()"
      @reload="reload()"
    />

    <!-- 鼠标提示 -->
    <div class="mouse-hint" v-if="isReady && !elevLayer.queryResult.value">
      点击地图查询海拔高度
    </div>

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady || elevLayer.isLoading.value">
      <div class="loading-spinner"></div>
      <p>正在加载高程图层...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import ElevationControlPanel from '@/components/ElevationControlPanel.vue'
import { useElevation } from '@/composables/useElevation'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const elevLayer = useElevation(viewer)

let clickHandler: Cesium.ScreenSpaceEventHandler | null = null

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

    // 初始视角：斜 45° 俯视中国，偏西以更好展示青藏高原地形
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(95, 25, 8000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })

    isReady.value = true

    // 加载高程图层
    elevLayer.loadData(48, 36)

    // 注册鼠标点击事件
    setupClickHandler()
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

function setupClickHandler() {
  if (!viewer.value) return

  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas)
  clickHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (!viewer.value) return

    const cartesian = viewer.value.camera.pickEllipsoid(
      event.position,
      viewer.value.scene.globe.ellipsoid,
    )
    if (!cartesian) return

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    const lon = Cesium.Math.toDegrees(cartographic.longitude)
    const lat = Cesium.Math.toDegrees(cartographic.latitude)

    const elev = elevLayer.queryElevation(lon, lat)
    if (elev !== null) {
      elevLayer.queryResult.value = { lon, lat, elev }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function reload() {
  elevLayer.loadData(48, 36)
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  if (clickHandler) {
    clickHandler.destroy()
    clickHandler = null
  }
  elevLayer.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.elevation-view {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.mouse-hint {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  pointer-events: none;
  z-index: 10;
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
