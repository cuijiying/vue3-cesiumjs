<template>
  <div class="temperature-grid-3d-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <TemperatureGrid3DControlPanel
      :is-visible="tempLayer.isVisible.value"
      :opacity="tempLayer.opacity.value"
      :height-scale="tempLayer.heightScale.value"
      :color-scale="tempLayer.colorScale.value"
      :grid-data="tempLayer.gridData.value"
      :query-result="tempLayer.queryResult.value"
      @toggle-visibility="tempLayer.toggleVisibility()"
      @set-opacity="tempLayer.setOpacity($event)"
      @set-height-scale="tempLayer.setHeightScale($event)"
      @set-color-scale="tempLayer.setColorScale($event)"
      @fly-to="tempLayer.flyToLayer()"
      @reload="reload()"
    />

    <!-- 鼠标提示 -->
    <div class="mouse-hint" v-if="isReady && !tempLayer.queryResult.value">
      点击地图查询温度值
    </div>

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady || tempLayer.isLoading.value">
      <div class="loading-spinner"></div>
      <p>正在加载三维温度格点图层...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import TemperatureGrid3DControlPanel from '@/components/TemperatureGrid3DControlPanel.vue'
import { useTemperatureGrid3D } from '@/composables/useTemperatureGrid3D'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const tempLayer = useTemperatureGrid3D(viewer)

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

    // 加载三维温度图层
    tempLayer.loadData(32, 32)

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

    const temp = tempLayer.queryTemperature(lon, lat)
    if (temp !== null) {
      tempLayer.queryResult.value = { lon, lat, temp }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function reload() {
  tempLayer.loadData(32, 32)
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  if (clickHandler) {
    clickHandler.destroy()
    clickHandler = null
  }
  tempLayer.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.temperature-grid-3d-view {
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
