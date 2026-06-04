import { ref, shallowRef, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  generateFloodTerrain,
  computeFloodStats,
  FLOOD_PRESETS,
  WATER_COLORS,
  type FloodTerrainData,
  type WaterColorName,
  type FloodPreset,
} from '@/data/floodData'

export function useFloodAnalysis(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  const isVisible = ref(true)
  const isLoading = ref(false)
  const waterLevel = ref(50)
  const waterOpacity = ref(0.6)
  const waterColor = ref<WaterColorName>('blue')
  const currentPreset = ref(0)
  const terrainData = shallowRef<FloodTerrainData | null>(null)
  const floodStats = ref<ReturnType<typeof computeFloodStats> | null>(null)
  const isAnimating = ref(false)
  const showTerrain = ref(true)

  let waterDataSource: Cesium.CustomDataSource | null = null
  let terrainDataSource: Cesium.CustomDataSource | null = null
  let animationTimer: ReturnType<typeof setInterval> | null = null

  function loadPreset(index: number) {
    isLoading.value = true
    currentPreset.value = index
    const preset = FLOOD_PRESETS[index]!
    waterLevel.value = preset.waterLevel
    terrainData.value = generateFloodTerrain(preset)
    updateFloodStats()
    rebuildTerrainEntities()
    rebuildWaterEntity()
    isLoading.value = false
  }

  function updateFloodStats() {
    const data = terrainData.value
    if (!data) return
    floodStats.value = computeFloodStats(data, waterLevel.value)
  }

  /** 重建地形实体（仅在切换预设/地形显隐时调用，不随水位变化） */
  function rebuildTerrainEntities() {
    const viewer = viewerRef.value
    const data = terrainData.value
    if (!viewer || !data) return

    if (terrainDataSource) viewer.dataSources.remove(terrainDataSource, true)
    terrainDataSource = new Cesium.CustomDataSource('floodTerrain')
    viewer.dataSources.add(terrainDataSource)

    if (!showTerrain.value) {
      terrainDataSource.show = isVisible.value
      return
    }

    const { lonMin, lonMax, latMin, latMax, cols, rows, values } = data
    const lonStep = (lonMax - lonMin) / (cols - 1)
    const latStep = (latMax - latMin) / (rows - 1)
    const boxLonSize = lonStep * 0.9
    const boxLatSize = latStep * 0.9

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lon = lonMin + col * lonStep
        const lat = latMax - row * latStep
        const elev = values[row * cols + col]!
        const meterLon = boxLonSize * 111000 * Math.cos((lat * Math.PI) / 180)
        const meterLat = boxLatSize * 111000

        const terrainHeight = Math.max(100, elev * 10)
        const t = (elev - data.minElev) / ((data.maxElev - data.minElev) || 1)

        // 基于高程的地形颜色：低 -> 绿色，高 -> 棕色
        const r = Math.round(80 + t * 120)
        const g = Math.round(140 + t * 80)
        const b = Math.round(60 + t * 40)

        terrainDataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, terrainHeight / 2),
          box: {
            dimensions: new Cesium.Cartesian3(meterLon, meterLat, terrainHeight),
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromBytes(r, g, b, 230),
            ),
            outline: false,
          },
        })
      }
    }

    terrainDataSource.show = isVisible.value
  }

  /**
   * 重建水面实体
   * 使用单个 Rectangle + CallbackProperty，水位变化时自动更新，无需重建实体
   */
  function rebuildWaterEntity() {
    const viewer = viewerRef.value
    const data = terrainData.value
    if (!viewer || !data) return

    if (waterDataSource) viewer.dataSources.remove(waterDataSource, true)
    waterDataSource = new Cesium.CustomDataSource('floodWater')
    viewer.dataSources.add(waterDataSource)

    const wc = WATER_COLORS[waterColor.value]
    const wAlpha = Math.round(waterOpacity.value * 255)

    // 单个矩形实体表示水面，使用 CallbackProperty 实时响应水位变化
    waterDataSource.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(
          data.lonMin, data.latMin, data.lonMax, data.latMax,
        ),
        height: 0,
        extrudedHeight: new Cesium.CallbackProperty(() => {
          return waterLevel.value * 10
        }, false),
        material: Cesium.Color.fromBytes(wc.r, wc.g, wc.b, wAlpha),
        outline: false,
      },
    })

    waterDataSource.show = isVisible.value
  }

  function setWaterLevel(level: number) {
    waterLevel.value = level
    updateFloodStats()
    // CallbackProperty 自动更新水面高度，无需重建实体
  }

  function setWaterOpacity(val: number) {
    waterOpacity.value = val
    rebuildWaterEntity()
  }

  function setWaterColor(color: WaterColorName) {
    waterColor.value = color
    rebuildWaterEntity()
  }

  function toggleVisibility() {
    isVisible.value = !isVisible.value
    if (waterDataSource) waterDataSource.show = isVisible.value
    if (terrainDataSource) terrainDataSource.show = isVisible.value
  }

  function toggleTerrain() {
    showTerrain.value = !showTerrain.value
    rebuildTerrainEntities()
  }

  /** 水位上涨动画 */
  function startAnimation() {
    if (isAnimating.value) return
    const data = terrainData.value
    if (!data) return

    isAnimating.value = true
    const startLevel = data.minElev
    const endLevel = data.maxElev * 0.8
    const step = (endLevel - startLevel) / 60
    waterLevel.value = startLevel

    animationTimer = setInterval(() => {
      waterLevel.value += step
      if (waterLevel.value >= endLevel) {
        waterLevel.value = endLevel
        stopAnimation()
      }
      updateFloodStats()
      // CallbackProperty 自动更新水面高度，无需重建实体
    }, 100)
  }

  function stopAnimation() {
    isAnimating.value = false
    if (animationTimer) {
      clearInterval(animationTimer)
      animationTimer = null
    }
  }

  function flyToLayer() {
    const viewer = viewerRef.value
    if (!viewer) return
    const preset = FLOOD_PRESETS[currentPreset.value]!
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        preset.center.lon,
        preset.center.lat,
        preset.center.height,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })
  }

  function destroy() {
    stopAnimation()
    const viewer = viewerRef.value
    if (viewer) {
      if (waterDataSource) {
        viewer.dataSources.remove(waterDataSource, true)
        waterDataSource = null
      }
      if (terrainDataSource) {
        viewer.dataSources.remove(terrainDataSource, true)
        terrainDataSource = null
      }
    }
  }

  return {
    isVisible,
    isLoading,
    waterLevel,
    waterOpacity,
    waterColor,
    currentPreset,
    terrainData,
    floodStats,
    isAnimating,
    showTerrain,
    loadPreset,
    setWaterLevel,
    setWaterOpacity,
    setWaterColor,
    toggleVisibility,
    toggleTerrain,
    startAnimation,
    stopAnimation,
    flyToLayer,
    destroy,
  }
}
