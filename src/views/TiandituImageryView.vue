<template>
  <div class="tianditu-imagery-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <!-- 图层控制面板 -->
    <div class="layer-control-panel">
      <h3>天地图图层控制</h3>
      <div class="layer-options">
        <label class="layer-option">
          <input
            type="radio"
            v-model="currentLayer"
            value="img"
            @change="switchLayer('img')"
          />
          <span>卫星影像</span>
        </label>
        <label class="layer-option">
          <input
            type="radio"
            v-model="currentLayer"
            value="vec"
            @change="switchLayer('vec')"
          />
          <span>矢量地图</span>
        </label>
        <label class="layer-option">
          <input
            type="radio"
            v-model="currentLayer"
            value="ter"
            @change="switchLayer('ter')"
          />
          <span>地形晕渲</span>
        </label>
      </div>
      <div class="annotation-toggle">
        <label>
          <input type="checkbox" v-model="showAnnotation" @change="toggleAnnotation" />
          <span>显示注记</span>
        </label>
      </div>
    </div>

    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在加载天地图...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import * as Cesium from 'cesium'

// 天地图 Token（请替换为您自己的 Token）
const TIANDITU_TOKEN = '3a11b44ee0e0ccfd902660ba177f17cb'

// 图层类型
type LayerType = 'img' | 'vec' | 'ter'

const viewer = shallowRef<Cesium.Viewer | null>(null)
const isReady = ref(false)
const currentLayer = ref<LayerType>('img')
const showAnnotation = ref(true)

// 天地图图层 URL 配置
const tiandituLayers = {
  // 卫星影像
  img: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TOKEN}`,
  // 卫星影像注记
  cia: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TOKEN}`,
  // 矢量地图
  vec: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TOKEN}`,
  // 矢量注记
  cva: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TOKEN}`,
  // 地形晕渲
  ter: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TOKEN}`,
  // 地形注记
  cta: `https://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_TOKEN}`,
}

// 注记图层映射
const annotationMap: Record<LayerType, keyof typeof tiandituLayers> = {
  img: 'cia',
  vec: 'cva',
  ter: 'cta',
}

let baseLayer: Cesium.ImageryLayer | null = null
let annotationLayer: Cesium.ImageryLayer | null = null

// 创建天地图影像提供器
function createTiandituProvider(layerKey: keyof typeof tiandituLayers) {
  return new Cesium.UrlTemplateImageryProvider({
    url: tiandituLayers[layerKey],
    subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
    minimumLevel: 0,
    maximumLevel: 18,
  })
}

// 切换底图图层
function switchLayer(layerType: LayerType) {
  if (!viewer.value) return

  const imageryLayers = viewer.value.imageryLayers

  // 移除现有图层
  if (baseLayer) {
    imageryLayers.remove(baseLayer)
  }
  if (annotationLayer) {
    imageryLayers.remove(annotationLayer)
  }

  // 添加新的底图图层
  baseLayer = imageryLayers.addImageryProvider(createTiandituProvider(layerType))

  // 如果需要显示注记，添加注记图层
  if (showAnnotation.value) {
    const annotationKey = annotationMap[layerType]
    annotationLayer = imageryLayers.addImageryProvider(createTiandituProvider(annotationKey))
  }

  currentLayer.value = layerType
}

// 切换注记显示
function toggleAnnotation() {
  if (!viewer.value) return

  const imageryLayers = viewer.value.imageryLayers

  if (showAnnotation.value) {
    // 添加注记图层
    const annotationKey = annotationMap[currentLayer.value]
    annotationLayer = imageryLayers.addImageryProvider(createTiandituProvider(annotationKey))
  } else {
    // 移除注记图层
    if (annotationLayer) {
      imageryLayers.remove(annotationLayer)
      annotationLayer = null
    }
  }
}

// 初始化 Cesium Viewer
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

    // 移除默认影像图层
    viewer.value.imageryLayers.removeAll()

    // 添加天地图卫星影像作为默认底图
    baseLayer = viewer.value.imageryLayers.addImageryProvider(createTiandituProvider('img'))

    // 添加注记图层
    annotationLayer = viewer.value.imageryLayers.addImageryProvider(createTiandituProvider('cia'))

    // 移除版权信息
    const creditContainer = viewer.value.cesiumWidget.creditContainer as HTMLElement
    if (creditContainer) {
      creditContainer.style.display = 'none'
    }

    // 设置初始视角到中国
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(104.06, 30.67, 10000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0,
      },
    })

    isReady.value = true
  } catch (error) {
    console.error('Cesium 初始化失败:', error)
  }
}

onMounted(() => {
  initViewer()
})

onUnmounted(() => {
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.tianditu-imagery-view {
  width: 100%;
  height: 100%;
  position: relative;

  .cesium-container {
    width: 100%;
    height: 100%;
  }

  .layer-control-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    min-width: 180px;

    h3 {
      margin: 0 0 16px 0;
      font-size: 1rem;
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }

    .layer-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;

      .layer-option {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 6px;
        transition: background 0.2s ease;

        &:hover {
          background: #f5f5f5;
        }

        input[type='radio'] {
          accent-color: #667eea;
        }

        span {
          font-size: 0.9rem;
          color: #555;
        }
      }
    }

    .annotation-toggle {
      border-top: 1px solid #eee;
      padding-top: 12px;

      label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;

        input[type='checkbox'] {
          accent-color: #667eea;
        }

        span {
          font-size: 0.9rem;
          color: #555;
        }
      }
    }
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
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    p {
      font-size: 1.2rem;
    }
  }
}
</style>
