<template>
  <div class="ai-detection-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <AIDetectionControlPanel
      :selected-region="ai.selectedRegion.value"
      :selected-model="ai.selectedModel.value"
      :is-analyzing="ai.isAnalyzing.value"
      :analysis-progress="ai.analysisProgress.value"
      :stats="ai.stats.value"
      :confidence-threshold="ai.confidenceThreshold.value"
      :selected-categories="ai.selectedCategories.value"
      :selected-target="ai.selectedTarget.value"
      :filtered-targets="ai.filteredTargets.value"
      :show-heatmap="ai.showHeatmap.value"
      @set-region="ai.setRegion($event)"
      @set-model="ai.setModel($event)"
      @run-analysis="ai.runAnalysis()"
      @set-confidence="ai.setConfidenceThreshold($event)"
      @toggle-category="ai.toggleCategory($event)"
      @toggle-heatmap="ai.toggleHeatmap()"
      @select-target="ai.selectTarget($event)"
      @clear="ai.clearResults()"
    />

    <!-- 鼠标提示 -->
    <div class="mouse-hint" v-if="isReady && !ai.stats.value">
      选择分析区域和 AI 模型，点击「运行 AI 分析」开始检测
    </div>

    <!-- 加载中 -->
    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在初始化 AI 检测系统...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, ref, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import AIDetectionControlPanel from '@/components/AIDetectionControlPanel.vue'
import { useAIDetection } from '@/composables/useAIDetection'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)

const ai = useAIDetection(viewer)

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

    // 设置初始视角
    const region = ai.selectedRegion.value
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        region.center.lon,
        region.center.lat,
        region.cameraHeight,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0,
      },
    })

    // 点击地图选中目标
    setupClickHandler()

    isReady.value = true
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

let clickHandler: Cesium.ScreenSpaceEventHandler | null = null

function setupClickHandler() {
  if (!viewer.value) return

  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas)
  clickHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (!viewer.value) return

    const picked = viewer.value.scene.pick(event.position)
    if (Cesium.defined(picked) && picked.id?.properties) {
      const targetId = picked.id.properties.targetId?.getValue()
      if (targetId) {
        const target = ai.filteredTargets.value.find((t) => t.id === targetId)
        if (target) {
          ai.selectTarget(target)
          return
        }
      }
    }
    // 点击空白区域取消选中
    ai.selectTarget(null)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  clickHandler?.destroy()
  clickHandler = null
  ai.destroy()
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.ai-detection-view {
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
    background: rgba(15, 23, 42, 0.8);
    color: #94a3b8;
    padding: 10px 24px;
    border-radius: 24px;
    font-size: 0.85rem;
    pointer-events: none;
    z-index: 50;
    border: 1px solid rgba(103, 232, 249, 0.2);
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #e2e8f0;
    z-index: 1000;

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(103, 232, 249, 0.2);
      border-top: 4px solid #06b6d4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    p {
      font-size: 1.1rem;
      color: #94a3b8;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
