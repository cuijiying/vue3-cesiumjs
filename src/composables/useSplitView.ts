import { onMounted, onUnmounted, shallowRef, ref } from 'vue'
import * as Cesium from 'cesium'

/**
 * 二三维分屏联动 Composable
 * 左侧二维地图 + 右侧三维地球，相机位置双向同步
 */
export function useSplitView(leftContainerId: string, rightContainerId: string) {
  const viewer2D = shallowRef<Cesium.Viewer | null>(null)
  const viewer3D = shallowRef<Cesium.Viewer | null>(null)
  const isReady = ref(false)

  // 追踪鼠标当前悬停在哪个面板上，只从该面板同步到另一个
  let activePane: '2d' | '3d' | null = null
  // 防止 setView 触发对方 postRender 回同步
  let syncing = false

  // 记录上一次同步的相机位置，避免无变化时重复 setView
  let lastSyncedPosition: { lon: number; lat: number; height: number } | null = null

  // 初始视角（北京）
  const defaultCenter = Cesium.Cartesian3.fromDegrees(116.397428, 39.909188, 800000)

  function createViewer(containerId: string, sceneMode: Cesium.SceneMode): Cesium.Viewer {
    const v = new Cesium.Viewer(containerId, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
      shouldAnimate: true,
      sceneMode,
    })

    const creditContainer = v.cesiumWidget.creditContainer as HTMLElement
    if (creditContainer) {
      creditContainer.style.display = 'none'
    }

    return v
  }

  /** 从源 viewer 读取相机经纬度高度 */
  function getCameraCartographic(viewer: Cesium.Viewer): Cesium.Cartographic | null {
    try {
      const cartographic = viewer.camera.positionCartographic
      if (
        cartographic &&
        isFinite(cartographic.longitude) &&
        isFinite(cartographic.latitude) &&
        isFinite(cartographic.height)
      ) {
        return cartographic
      }
    } catch {
      // positionCartographic 在某些 2D 边界情况下可能异常
    }
    return null
  }

  /** 判断位置是否有显著变化 */
  function hasPositionChanged(cartographic: Cesium.Cartographic): boolean {
    if (!lastSyncedPosition) return true
    const EPS = 1e-8
    return (
      Math.abs(cartographic.longitude - lastSyncedPosition.lon) > EPS ||
      Math.abs(cartographic.latitude - lastSyncedPosition.lat) > EPS ||
      Math.abs(cartographic.height - lastSyncedPosition.height) > cartographic.height * 1e-6
    )
  }

  /** postRender 回调：每帧检测活跃面板的相机变化并同步 */
  function onPostRender() {
    if (syncing || !viewer2D.value || !viewer3D.value || !activePane) return

    const sourceViewer = activePane === '2d' ? viewer2D.value : viewer3D.value
    const targetViewer = activePane === '2d' ? viewer3D.value : viewer2D.value
    const isSourceIs2D = activePane === '2d'

    const cartographic = getCameraCartographic(sourceViewer)
    if (!cartographic || !hasPositionChanged(cartographic)) return

    lastSyncedPosition = {
      lon: cartographic.longitude,
      lat: cartographic.latitude,
      height: cartographic.height,
    }

    syncing = true
    try {
      const destination = Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height,
      )
      if (isSourceIs2D) {
        // 2D → 3D：给 3D 加一个俯视角
        targetViewer.camera.setView({
          destination,
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
        })
      } else {
        // 3D → 2D
        targetViewer.camera.setView({ destination })
      }
    } finally {
      syncing = false
    }
  }

  let removePostRender2D: Cesium.Event.RemoveCallback | null = null
  let removePostRender3D: Cesium.Event.RemoveCallback | null = null

  // 鼠标事件处理函数（需要在 unmount 时移除）
  function onEnter2D() { activePane = '2d' }
  function onEnter3D() { activePane = '3d' }

  function initViewers() {
    try {
      viewer2D.value = createViewer(leftContainerId, Cesium.SceneMode.SCENE2D)
      viewer3D.value = createViewer(rightContainerId, Cesium.SceneMode.SCENE3D)

      // 设置初始视角
      viewer2D.value.camera.setView({ destination: defaultCenter })
      viewer3D.value.camera.setView({
        destination: defaultCenter,
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
      })

      // 追踪鼠标所在面板
      document.getElementById(leftContainerId)?.addEventListener('pointerenter', onEnter2D)
      document.getElementById(rightContainerId)?.addEventListener('pointerenter', onEnter3D)

      // 使用 postRender 逐帧同步（比 camera.changed 更可靠，拖拽时也能实时触发）
      removePostRender2D = viewer2D.value.scene.postRender.addEventListener(onPostRender)
      removePostRender3D = viewer3D.value.scene.postRender.addEventListener(onPostRender)

      isReady.value = true
    } catch (error) {
      console.error('分屏视图初始化失败:', error)
    }
  }

  /** 飞行到指定位置（同时更新两个视图） */
  function flyTo(longitude: number, latitude: number, height: number = 800000) {
    // flyTo 期间暂停同步
    activePane = null
    lastSyncedPosition = null
    const destination = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    viewer2D.value?.camera.flyTo({ destination, duration: 1.5 })
    viewer3D.value?.camera.flyTo({
      destination,
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.5,
    })
  }

  onMounted(() => {
    initViewers()
  })

  onUnmounted(() => {
    removePostRender2D?.()
    removePostRender3D?.()
    document.getElementById(leftContainerId)?.removeEventListener('pointerenter', onEnter2D)
    document.getElementById(rightContainerId)?.removeEventListener('pointerenter', onEnter3D)
    if (viewer2D.value) {
      viewer2D.value.destroy()
      viewer2D.value = null
    }
    if (viewer3D.value) {
      viewer3D.value.destroy()
      viewer3D.value = null
    }
  })

  return {
    viewer2D,
    viewer3D,
    isReady,
    flyTo,
  }
}
