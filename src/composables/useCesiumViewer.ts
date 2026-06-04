import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import * as Cesium from 'cesium'

/**
 * Cesium 地图初始化 Composable
 */
export function useCesiumViewer(containerId: string) {
  const viewer: Ref<Cesium.Viewer | null> = ref(null)
  const isReady = ref(false)

  const initViewer = () => {
    try {
      // 从环境变量读取 Cesium Ion 访问令牌
      Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN

      viewer.value = new Cesium.Viewer(containerId, {
        animation: false, // 不显示动画控件
        timeline: false, // 不显示时间轴
        baseLayerPicker: false, // 不显示图层选择器
        geocoder: false, // 不显示地理编码器
        homeButton: false , // 显示主页按钮
        sceneModePicker: false, // 不显示场景模式选择器
        navigationHelpButton: false, // 不显示帮助按钮
        fullscreenButton: false, // 不显示全屏按钮
        vrButton: false, // 不显示VR按钮
        shouldAnimate: true, // 启用动画
      })

      // 替换默认影像图层为高德地图
    //   viewer.value.imageryLayers.removeAll()
    //   viewer.value.imageryLayers.addImageryProvider(
    //     new Cesium.UrlTemplateImageryProvider({
    //       url: 'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    //       minimumLevel: 3,
    //       maximumLevel: 18,
    //     })
    //   )

      // 移除 Cesium 默认的版权信息
      const creditContainer = viewer.value.cesiumWidget.creditContainer as HTMLElement
      if (creditContainer) {
        creditContainer.style.display = 'none'
      }

      // 设置初始视角到北京
      viewer.value.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(116.397428, 39.909188, 5000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-30),
          roll: 0.0,
        },
      })

      // 启用深度测试
      viewer.value.scene.globe.depthTestAgainstTerrain = false

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

  return {
    viewer,
    isReady,
  }
}
