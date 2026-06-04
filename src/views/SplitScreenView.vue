<template>
  <div class="split-screen-view">
    <div class="split-container">
      <!-- 左侧：二维地图 -->
      <div class="split-pane left-pane">
        <div class="pane-label">2D 地图</div>
        <div id="viewer2D" class="cesium-container"></div>
      </div>

      <!-- 分隔条 -->
      <div class="split-divider"></div>

      <!-- 右侧：三维地球 -->
      <div class="split-pane right-pane">
        <div class="pane-label">3D 地球</div>
        <div id="viewer3D" class="cesium-container"></div>
      </div>
    </div>

    <!-- 快捷定位面板 -->
    <div class="location-panel">
      <h3>快捷定位</h3>
      <div class="location-buttons">
        <button
          v-for="loc in locations"
          :key="loc.name"
          class="location-btn"
          @click="flyTo(loc.lon, loc.lat, loc.height)"
        >
          {{ loc.icon }} {{ loc.name }}
        </button>
      </div>
    </div>

    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在加载分屏视图...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSplitView } from '@/composables/useSplitView'

const { isReady, flyTo } = useSplitView('viewer2D', 'viewer3D')

const locations = [
  { name: '北京', icon: '🏛️', lon: 116.397428, lat: 39.909188, height: 800000 },
  { name: '上海', icon: '🏙️', lon: 121.473701, lat: 31.230416, height: 800000 },
  { name: '广州', icon: '🌺', lon: 113.264385, lat: 23.129110, height: 800000 },
  { name: '成都', icon: '🐼', lon: 104.065735, lat: 30.659462, height: 800000 },
  { name: '珠穆朗玛峰', icon: '🏔️', lon: 86.925145, lat: 27.988121, height: 200000 },
  { name: '全球视角', icon: '🌍', lon: 105.0, lat: 35.0, height: 10000000 },
]
</script>

<style scoped>
.split-screen-view {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.split-container {
  display: flex;
  width: 100%;
  height: 100%;
}

.split-pane {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.left-pane {
  border-right: none;
}

.split-divider {
  width: 4px;
  background: #1a1a2e;
  cursor: col-resize;
  flex-shrink: 0;
  z-index: 10;
}

.pane-label {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 6px 18px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.cesium-container {
  width: 100%;
  height: 100%;
}

/* 快捷定位面板 */
.location-panel {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(10, 10, 30, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 14px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.location-panel h3 {
  color: #fff;
  font-size: 13px;
  margin: 0 0 10px 0;
  text-align: center;
  opacity: 0.8;
}

.location-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.location-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}

.location-btn:hover {
  background: rgba(66, 133, 244, 0.5);
  border-color: rgba(66, 133, 244, 0.8);
  transform: translateY(-1px);
}

/* 加载提示 */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  color: #fff;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #4285f4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

<!-- 全局样式：强制 Cesium widget 撑满容器 -->
<style>
.cesium-container .cesium-viewer,
.cesium-container .cesium-viewer-cesiumWidgetContainer,
.cesium-container .cesium-widget,
.cesium-container .cesium-widget canvas {
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
}

.cesium-container .cesium-viewer-toolbar,
.cesium-container .cesium-viewer-bottom {
  display: none !important;
}
</style>
