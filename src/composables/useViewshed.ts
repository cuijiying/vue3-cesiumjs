import { ref, shallowRef, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  analyzeViewshed,
  createTerrainSampler,
  VIEWSHED_PRESETS,
  type ViewshedParams,
  type ViewshedResult,
  type ViewshedPreset,
} from '@/data/viewshedData'

export function useViewshed(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  const isVisible = ref(true)
  const isLoading = ref(false)
  const result = shallowRef<ViewshedResult | null>(null)
  const currentPreset = ref(0)
  const showFrustum = ref(true)
  const visibleColor = ref<'green' | 'blue'>('green')
  const opacity = ref(0.6)

  let sampleDataSource: Cesium.CustomDataSource | null = null
  let frustumDataSource: Cesium.CustomDataSource | null = null
  let obstacleDataSource: Cesium.CustomDataSource | null = null

  // 当前地形采样器
  let terrainSampler: ((lon: number, lat: number) => number) | null = null

  function runAnalysis(params?: ViewshedParams, seed?: number) {
    const viewer = viewerRef.value
    if (!viewer) return

    isLoading.value = true

    const preset = VIEWSHED_PRESETS[currentPreset.value]!
    const p = params ?? preset.params
    const s = seed ?? preset.terrainSeed

    terrainSampler = createTerrainSampler(p.lon, p.lat, p.radius, s)
    const analysisResult = analyzeViewshed(p, terrainSampler, 2, 40)
    result.value = analysisResult

    rebuildEntities()
    isLoading.value = false
  }

  function rebuildEntities() {
    const viewer = viewerRef.value
    const data = result.value
    if (!viewer || !data) return

    clearEntities(viewer)

    // 采样点图层
    sampleDataSource = new Cesium.CustomDataSource('viewshedSamples')
    viewer.dataSources.add(sampleDataSource)

    // 视锥图层
    frustumDataSource = new Cesium.CustomDataSource('viewshedFrustum')
    viewer.dataSources.add(frustumDataSource)

    // 遮挡物图层
    obstacleDataSource = new Cesium.CustomDataSource('viewshedObstacles')
    viewer.dataSources.add(obstacleDataSource)

    const { params, samples } = data
    const mPerDeg = 111000

    // 绘制采样点（矩形色块）
    const degStep = (params.radius / mPerDeg) / 40 * 0.8
    const visColor = visibleColor.value === 'green'
      ? Cesium.Color.fromAlpha(Cesium.Color.LIME, opacity.value)
      : Cesium.Color.fromAlpha(Cesium.Color.DEEPSKYBLUE, opacity.value)
    const invisColor = Cesium.Color.fromAlpha(Cesium.Color.RED, opacity.value)

    for (const sample of samples) {
      const color = sample.visible ? visColor : invisColor
      sampleDataSource.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            sample.lon - degStep / 2,
            sample.lat - degStep / 2,
            sample.lon + degStep / 2,
            sample.lat + degStep / 2,
          ),
          material: new Cesium.ColorMaterialProperty(color),
          height: 0.5,
          outline: false,
        },
      })
    }

    // 绘制观察点
    sampleDataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(params.lon, params.lat, params.height),
      point: {
        pixelSize: 14,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '观察点',
        font: 'bold 14px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    // 绘制观察点底部标记线（从地面到观察高度）
    sampleDataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          params.lon, params.lat, 0,
          params.lon, params.lat, params.height,
        ]),
        width: 2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW.withAlpha(0.8)),
      },
    })

    // 绘制视锥体轮廓
    if (showFrustum.value) {
      drawFrustumOutline(params)
    }

    // 绘制遮挡物（模拟建筑/山丘）
    drawObstacles(params)

    sampleDataSource.show = isVisible.value
    frustumDataSource.show = isVisible.value && showFrustum.value
    obstacleDataSource.show = isVisible.value
  }

  function drawFrustumOutline(params: ViewshedParams) {
    if (!frustumDataSource) return
    const mPerDeg = 111000
    const headingRad = (params.heading * Math.PI) / 180
    const halfFovH = (params.fovH / 2 * Math.PI) / 180

    // 视锥扇形边缘线
    const leftAzimuth = headingRad - halfFovH
    const rightAzimuth = headingRad + halfFovH

    const leftEndLon = params.lon + (Math.sin(leftAzimuth) * params.radius) / (mPerDeg * Math.cos((params.lat * Math.PI) / 180))
    const leftEndLat = params.lat + (Math.cos(leftAzimuth) * params.radius) / mPerDeg
    const rightEndLon = params.lon + (Math.sin(rightAzimuth) * params.radius) / (mPerDeg * Math.cos((params.lat * Math.PI) / 180))
    const rightEndLat = params.lat + (Math.cos(rightAzimuth) * params.radius) / mPerDeg

    // 左边线
    frustumDataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          params.lon, params.lat, params.height,
          leftEndLon, leftEndLat, 1,
        ]),
        width: 2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.8)),
      },
    })

    // 右边线
    frustumDataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          params.lon, params.lat, params.height,
          rightEndLon, rightEndLat, 1,
        ]),
        width: 2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.8)),
      },
    })

    // 弧线（视场外边缘）
    const arcPositions: number[] = []
    const arcSteps = Math.max(8, Math.ceil(params.fovH / 3))
    for (let i = 0; i <= arcSteps; i++) {
      const t = i / arcSteps
      const azimuth = leftAzimuth + t * (rightAzimuth - leftAzimuth)
      const lon = params.lon + (Math.sin(azimuth) * params.radius) / (mPerDeg * Math.cos((params.lat * Math.PI) / 180))
      const lat = params.lat + (Math.cos(azimuth) * params.radius) / mPerDeg
      arcPositions.push(lon, lat, 1)
    }
    frustumDataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(arcPositions),
        width: 2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.CYAN.withAlpha(0.6)),
      },
    })
  }

  function drawObstacles(params: ViewshedParams) {
    if (!obstacleDataSource || !terrainSampler) return
    const mPerDeg = 111000
    const degRadius = params.radius / mPerDeg

    // 在分析范围内均匀采样绘制遮挡物
    const gridSize = 60
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const lon = params.lon - degRadius + (2 * degRadius * i) / (gridSize - 1)
        const lat = params.lat - degRadius + (2 * degRadius * j) / (gridSize - 1)
        const elev = terrainSampler(lon, lat)
        if (elev > 15) {
          const degSize = (degRadius * 2) / gridSize * 0.9
          obstacleDataSource.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, elev / 2),
            box: {
              dimensions: new Cesium.Cartesian3(
                degSize * mPerDeg * Math.cos((lat * Math.PI) / 180),
                degSize * mPerDeg,
                elev,
              ),
              material: new Cesium.ColorMaterialProperty(
                Cesium.Color.fromCssColorString('#556677').withAlpha(0.7),
              ),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('#334455').withAlpha(0.5),
              outlineWidth: 1.0,
            },
          })
        }
      }
    }
  }

  function clearEntities(viewer: Cesium.Viewer) {
    if (sampleDataSource) {
      viewer.dataSources.remove(sampleDataSource, true)
      sampleDataSource = null
    }
    if (frustumDataSource) {
      viewer.dataSources.remove(frustumDataSource, true)
      frustumDataSource = null
    }
    if (obstacleDataSource) {
      viewer.dataSources.remove(obstacleDataSource, true)
      obstacleDataSource = null
    }
  }

  function toggleVisibility() {
    isVisible.value = !isVisible.value
    if (sampleDataSource) sampleDataSource.show = isVisible.value
    if (frustumDataSource) frustumDataSource.show = isVisible.value && showFrustum.value
    if (obstacleDataSource) obstacleDataSource.show = isVisible.value
  }

  function toggleFrustum() {
    showFrustum.value = !showFrustum.value
    if (frustumDataSource) frustumDataSource.show = isVisible.value && showFrustum.value
  }

  function setOpacity(val: number) {
    opacity.value = val
    rebuildEntities()
  }

  function setVisibleColor(color: 'green' | 'blue') {
    visibleColor.value = color
    rebuildEntities()
  }

  function switchPreset(index: number) {
    currentPreset.value = index
    runAnalysis()
  }

  function flyToObserver() {
    const viewer = viewerRef.value
    const data = result.value
    if (!viewer || !data) return

    const { params } = data
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(params.lon, params.lat, params.radius * 3),
      orientation: {
        heading: Cesium.Math.toRadians(params.heading),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })
  }

  function destroy() {
    const viewer = viewerRef.value
    if (viewer) {
      clearEntities(viewer)
    }
    terrainSampler = null
  }

  return {
    isVisible,
    isLoading,
    result,
    currentPreset,
    showFrustum,
    visibleColor,
    opacity,
    runAnalysis,
    toggleVisibility,
    toggleFrustum,
    setOpacity,
    setVisibleColor,
    switchPreset,
    flyToObserver,
    destroy,
  }
}
