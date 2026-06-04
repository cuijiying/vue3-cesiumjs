<template>
  <div class="temperature-grid-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <TemperatureControlPanel
      :is-visible="tempLayer.isVisible.value"
      :opacity="tempLayer.opacity.value"
      :color-scale="tempLayer.colorScale.value"
      :grid-data="tempLayer.gridData.value"
      :query-result="queryResult"
      :filter-min="tempLayer.filterMin.value"
      :filter-max="tempLayer.filterMax.value"
      @toggle-visibility="tempLayer.toggleVisibility()"
      @set-opacity="tempLayer.setOpacity($event)"
      @set-color-scale="tempLayer.setColorScale($event)"
      @set-filter="(min: number, max: number) => tempLayer.setFilterRange(min, max)"
      @reset-filter="tempLayer.resetFilter()"
      @fly-to="tempLayer.flyToLayer()"
      @reload="reload()"
    />

    <!-- 鼠标提示 -->
    <div class="mouse-hint" v-if="isReady && !queryResult">
      点击地图查询温度值
    </div>

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady || tempLayer.isLoading.value">
      <div class="loading-spinner"></div>
      <p>正在加载温度格点图层...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import TemperatureControlPanel from '@/components/TemperatureControlPanel.vue'
import { useTemperatureLayer } from '@/composables/useTemperatureLayer'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)
const queryResult = ref<{ lon: number; lat: number; temp: number } | null>(null)

const tempLayer = useTemperatureLayer(viewer)

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

    // 移除版权信息
    const creditContainer = viewer.value.cesiumWidget.creditContainer as HTMLElement
    if (creditContainer) {
      creditContainer.style.display = 'none'
    }

    // 设置初始视角到中国全境
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(104.06, 36.0, 6000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
    })

    isReady.value = true

    // 加载温度图层
    tempLayer.loadData(128, 128)

    // 注册鼠标点击事件，查询温度
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
      queryResult.value = { lon, lat, temp }
    } else {
      queryResult.value = null
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function reload() {
  queryResult.value = null
  tempLayer.loadData(128, 128)
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  clickHandler?.destroy()
  clickHandler = null
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.temperature-grid-view {
  width: 100%;
  height: 100%;
  position: relative;

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
    color: white;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 0.85rem;
    pointer-events: none;
    z-index: 50;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 1000;

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    p {
      font-size: 1.1rem;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
