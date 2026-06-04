<template>
  <div class="tianditu-label3d-view">
    <div id="cesiumLabel3DContainer" class="cesium-container"></div>

    <!-- 控制面板 -->
    <div class="layer-control-panel">
      <h3>天地图 3D 注记</h3>

      <div class="control-group">
        <label class="control-item">
          <input type="checkbox" v-model="useTerrain" @change="toggleTerrain" />
          <span>三维地形</span>
        </label>
      </div>

      <div class="control-group base-group">
        <p class="group-title">底图选择</p>
        <label class="control-item">
          <input type="radio" v-model="currentBase" value="img" @change="switchBase('img')" />
          <span>卫星影像</span>
        </label>
        <label class="control-item">
          <input type="radio" v-model="currentBase" value="vec" @change="switchBase('vec')" />
          <span>矢量地图</span>
        </label>
      </div>

      <p class="tip">三维地名注记由天地图 GeoWTFS 服务提供。三维地形/影像需使用您已开通“三维服务”权限的 Token。</p>
    </div>

    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>{{ loadingText }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'

// 天地图 Token（请替换为您自己的 Token）
const TIANDITU_TOKEN = '3a11b44ee0e0ccfd902660ba177f17cb'

type BaseType = 'img' | 'vec'

// 天地图官方三维服务依赖其专有的 Cesium 1.108 与扩展插件（GeoWTFS / GeoTerrainProvider），
// 需挂载在 window.Cesium 上，无法用 npm 的 cesium 模块替代，故按官方文档动态加载其 CDN 资源。
const TDT_CDN = 'https://api.tianditu.gov.cn/cdn'
const TDT_SCRIPTS = [
  `${TDT_CDN}/demo/sanwei/static/cesium/Cesium.js`,
  `${TDT_CDN}/plugins/cesium/Cesium_ext_min.js`,
  `${TDT_CDN}/plugins/cesium/long.min.js`,
  `${TDT_CDN}/plugins/cesium/bytebuffer.min.js`,
  `${TDT_CDN}/plugins/cesium/protobuf.min.js`,
]
const TDT_CSS = `${TDT_CDN}/demo/sanwei/static/cesium/Widgets/widgets.css`

// 服务域名与负载子域
const tdtUrl = 'https://t{s}.tianditu.gov.cn/'
const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7']

const viewer = shallowRef<any>(null)
const isReady = ref(false)
const loadingText = ref('正在加载天地图三维插件...')
const currentBase = ref<BaseType>('img')
// 三维地形/三维地名依赖天地图 GeoTerrainProvider。请使用您自己申请、并已开通
// “三维服务”权限的 Token；公共演示 Token 在 localhost 下地形 GetCapabilities 会被服务端拒绝（418）。
const useTerrain = ref(true)

let baseLayer: any = null
let terrainProvider: any = null
let wtfs: any = null

// 动态加载样式
function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute('cesium', 'true')
  document.head.appendChild(link)
}

// 顺序加载脚本（天地图扩展插件之间存在依赖，必须按顺序加载）
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.setAttribute('cesium', 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`脚本加载失败: ${src}`))
    document.head.appendChild(script)
  })
}

// 加载天地图三维 SDK（Cesium + 扩展插件）
async function loadTiandituSdk() {
  loadCss(TDT_CSS)
  for (const src of TDT_SCRIPTS) {
    await loadScript(src)
  }
}

// 创建天地图影像底图提供器（三维插件使用 DataServer 接口 + WebMercator 切片）
function createBaseProvider(type: BaseType) {
  const Cesium = (window as any).Cesium
  return new Cesium.UrlTemplateImageryProvider({
    url: `${tdtUrl}DataServer?T=${type}_w&x={x}&y={y}&l={z}&tk=${TIANDITU_TOKEN}`,
    subdomains,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18,
  })
}

// 切换底图
function switchBase(type: BaseType) {
  if (!viewer.value) return
  const layers = viewer.value.imageryLayers
  if (baseLayer) {
    layers.remove(baseLayer)
  }
  baseLayer = viewer.value.imageryLayers.addImageryProvider(createBaseProvider(type))
  // 保证底图位于最底层
  layers.lowerToBottom(baseLayer)
  currentBase.value = type
}

// // 创建天地图三维地形提供器（官方 GeoTerrainProvider）
// function createTerrainProvider() {
//   const Cesium = (window as any).Cesium
//   const terrainUrls: string[] = []
//   for (const s of subdomains) {
//     terrainUrls.push(`${tdtUrl.replace('{s}', s)}mapservice/swdx?T=elv_c&tk=${TIANDITU_TOKEN}`)
//   }
//   return new Cesium.GeoTerrainProvider({ urls: terrainUrls })
// }

// // 切换三维地形（懒加载：仅在开启时才创建 GeoTerrainProvider，避免未授权时构造即报 CORS）
// function toggleTerrain() {
//   if (!viewer.value) return
//   const Cesium = (window as any).Cesium
//   if (useTerrain.value) {
//     if (!terrainProvider) {
//       terrainProvider = createTerrainProvider()
//     }
//     viewer.value.terrainProvider = terrainProvider
//   } else {
//     viewer.value.terrainProvider = new Cesium.EllipsoidTerrainProvider()
//   }
// }

// 生成 GeoWTFS 三维地名服务初始化所需的根瓦片（第 2 级，全球 8×4 网格，每片 45°×45°）
function buildInitTiles() {
  const tiles: any[] = []
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 4; y++) {
      tiles.push({
        x,
        y,
        level: 2,
        boundBox: {
          minX: -180 + x * 45,
          minY: 90 - (y + 1) * 45,
          maxX: -180 + (x + 1) * 45,
          maxY: 90 - y * 45,
        },
      })
    }
  }
  return tiles
}

// 叠加天地图三维地名服务（GeoWTFS）
function loadLabel3D() {
  const Cesium = (window as any).Cesium
  wtfs = new Cesium.GeoWTFS({
    viewer: viewer.value,
    subdomains,
    metadata: {
      boundBox: { minX: -180, minY: -90, maxX: 180, maxY: 90 },
      minLevel: 1,
      maxLevel: 20,
    },
    depthTestOptimization: true,
    dTOElevation: 15000,
    dTOPitch: Cesium.Math.toRadians(-70),
    aotuCollide: true, // 是否开启避让
    collisionPadding: [5, 10, 8, 5], // 避让内边距：上、右、下、左
    serverFirstStyle: true, // 服务端样式优先
    labelGraphics: {
      font: '28px sans-serif',
      fontSize: 28,
      fillColor: Cesium.Color.WHITE,
      scale: 0.5,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: false,
      backgroundColor: Cesium.Color.RED,
      backgroundPadding: new Cesium.Cartesian2(10, 10),
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      eyeOffset: Cesium.Cartesian3.ZERO,
      pixelOffset: new Cesium.Cartesian2(5, 5),
      disableDepthTestDistance: undefined,
    },
    billboardGraphics: {
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      eyeOffset: Cesium.Cartesian3.ZERO,
      pixelOffset: Cesium.Cartesian2.ZERO,
      alignedAxis: Cesium.Cartesian3.ZERO,
      color: Cesium.Color.WHITE,
      rotation: 0,
      scale: 1,
      width: 18,
      height: 18,
      disableDepthTestDistance: undefined,
    },
  })

  // 三维地名服务瓦片地址（wtfs 服务）
  wtfs.getTileUrl = function () {
    return `${tdtUrl}mapservice/GetTiles?lxys={z},{x},{y}&VERSION=1.0.0&tk=${TIANDITU_TOKEN}`
  }
  // 三维图标服务
  wtfs.getIcoUrl = function () {
    return `${tdtUrl}mapservice/GetIcon?id={id}&tk=${TIANDITU_TOKEN}`
  }

  // 初始化天地图三维地名服务
  wtfs.initTDT(buildInitTiles())
}

// 初始化三维地球
function initViewer() {
  const Cesium = (window as any).Cesium

  // 使用天地图扩展的 Cesium.Map 初始化三维球（完全按官方三维示例）
  viewer.value = new Cesium.Map('cesiumLabel3DContainer', {
    shouldAnimate: true,
    selectionIndicator: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    timeline: false,
    animation: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    showRenderLoopErrors: false,
    shadows: false,
  })

  const scene = viewer.value.scene
  scene.postProcessStages.fxaa.enabled = false
  // 水雾特效
  scene.globe.showGroundAtmosphere = true
  // 相机控制参数（参考官方示例）
  scene.screenSpaceCameraController.constrainedPitch = Cesium.Math.toRadians(-20)
  scene.screenSpaceCameraController.autoResetHeadingPitch = false
  scene.screenSpaceCameraController.inertiaZoom = 0.5
  scene.screenSpaceCameraController.minimumZoomDistance = 50
  scene.screenSpaceCameraController.maximumZoomDistance = 20000000

  // 叠加天地图影像底图（不移除默认层，与官方示例一致）
  baseLayer = viewer.value.imageryLayers.addImageryProvider(createBaseProvider('img'))

//   // 叠加三维地形服务（官方 GeoTerrainProvider）
//   if (useTerrain.value) {
//     terrainProvider = createTerrainProvider()
//     viewer.value.terrainProvider = terrainProvider
//   }

  // 三维地形默认不加载（需 Token 配置域名白名单，由用户手动开启）

  // 隐藏版权信息
  const creditContainer = viewer.value.cesiumWidget.creditContainer as HTMLElement
  if (creditContainer) {
    creditContainer.style.display = 'none'
  }

  // 定位到中国（官方示例视角）
  viewer.value.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(103.84, 31.15, 17850000),
    orientation: {
      heading: Cesium.Math.toRadians(348.4202942851978),
      pitch: Cesium.Math.toRadians(-89.74026687972041),
      roll: 0,
    },
  })

  // 叠加三维地名服务
  loadLabel3D()
}

onMounted(async () => {
  try {
    await loadTiandituSdk()
    loadingText.value = '正在初始化三维地球...'
    initViewer()
    isReady.value = true
  } catch (error) {
    console.error('天地图三维服务加载失败:', error)
    loadingText.value = '天地图三维服务加载失败，请检查网络或 Token'
  }
})

onUnmounted(() => {
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped lang="scss">
.tianditu-label3d-view {
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

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .group-title {
        margin: 0 0 4px 0;
        font-size: 0.85rem;
        color: #999;
      }

      .control-item {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 6px 10px;
        border-radius: 6px;
        transition: background 0.2s ease;

        &:hover {
          background: #f5f5f5;
        }

        input[type='checkbox'],
        input[type='radio'] {
          accent-color: #667eea;
        }

        span {
          font-size: 0.9rem;
          color: #555;
        }
      }
    }

    .base-group {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .tip {
      margin: 14px 0 0 0;
      padding-top: 12px;
      border-top: 1px solid #eee;
      font-size: 0.75rem;
      color: #999;
      line-height: 1.5;
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
