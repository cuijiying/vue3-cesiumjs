import { ref, shallowRef, watch, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  generateTemperatureGrid3D,
  interpolateColor,
  TEMP3D_COLOR_SCALES,
  type TemperatureGrid3DData,
  type Temp3DColorScaleName,
} from '@/data/temperatureGrid3D'

export function useTemperatureGrid3D(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  const isVisible = ref(true)
  const isLoading = ref(false)
  const heightScale = ref(50)
  const opacity = ref(0.85)
  const colorScale = ref<Temp3DColorScaleName>('classic')
  const gridData = shallowRef<TemperatureGrid3DData | null>(null)
  const queryResult = ref<{ lon: number; lat: number; temp: number } | null>(null)

  let dataSource: Cesium.CustomDataSource | null = null

  function loadData(cols = 32, rows = 32) {
    isLoading.value = true
    gridData.value = generateTemperatureGrid3D(cols, rows)
    rebuildEntities()
    isLoading.value = false
  }

  function rebuildEntities() {
    const viewer = viewerRef.value
    const data = gridData.value
    if (!viewer || !data) return

    // 移除旧数据源
    if (dataSource) {
      viewer.dataSources.remove(dataSource, true)
    }

    dataSource = new Cesium.CustomDataSource('temperatureGrid3D')
    viewer.dataSources.add(dataSource)

    const { lonMin, lonMax, latMin, latMax, cols, rows, values, minTemp, maxTemp } = data
    const range = maxTemp - minTemp || 1
    const stops = TEMP3D_COLOR_SCALES[colorScale.value]
    const lonStep = (lonMax - lonMin) / (cols - 1)
    const latStep = (latMax - latMin) / (rows - 1)
    // 柱体宽度略小于格点间距，避免完全相连
    const boxLonSize = lonStep * 0.8
    const boxLatSize = latStep * 0.8

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lon = lonMin + col * lonStep
        const lat = latMax - row * latStep
        const temp = values[row * cols + col]!
        const t = (temp - minTemp) / range
        const height = Math.max(1000, t * heightScale.value * 10000)
        const [r, g, b] = interpolateColor(t, stops)

        dataSource.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, height / 2),
          box: {
            dimensions: new Cesium.Cartesian3(
              boxLonSize * 111000 * Math.cos((lat * Math.PI) / 180),
              boxLatSize * 111000,
              height,
            ),
            material: new Cesium.ColorMaterialProperty(
              Cesium.Color.fromBytes(r, g, b, Math.round(opacity.value * 255)),
            ),
            outline: false,
          },
          properties: {
            temperature: temp,
            longitude: lon,
            latitude: lat,
          } as any,
        })
      }
    }

    dataSource.show = isVisible.value
  }

  function toggleVisibility() {
    isVisible.value = !isVisible.value
    if (dataSource) {
      dataSource.show = isVisible.value
    }
  }

  function setOpacity(val: number) {
    opacity.value = val
    rebuildEntities()
  }

  function setHeightScale(val: number) {
    heightScale.value = val
    rebuildEntities()
  }

  function setColorScale(name: Temp3DColorScaleName) {
    colorScale.value = name
    rebuildEntities()
  }

  function flyToLayer() {
    const viewer = viewerRef.value
    if (!viewer) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(104.06, 21.0, 6000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })
  }

  function queryTemperature(lon: number, lat: number): number | null {
    const data = gridData.value
    if (!data) return null

    const { lonMin, lonMax, latMin, latMax, cols, rows, values } = data
    if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) return null

    const colF = ((lon - lonMin) / (lonMax - lonMin)) * (cols - 1)
    const rowF = ((latMax - lat) / (latMax - latMin)) * (rows - 1)

    const col0 = Math.floor(colF)
    const row0 = Math.floor(rowF)
    const col1 = Math.min(col0 + 1, cols - 1)
    const row1 = Math.min(row0 + 1, rows - 1)

    const fx = colF - col0
    const fy = rowF - row0

    const v00 = values[row0 * cols + col0]!
    const v10 = values[row0 * cols + col1]!
    const v01 = values[row1 * cols + col0]!
    const v11 = values[row1 * cols + col1]!

    return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
  }

  function destroy() {
    const viewer = viewerRef.value
    if (viewer && dataSource) {
      viewer.dataSources.remove(dataSource, true)
      dataSource = null
    }
  }

  return {
    isVisible,
    isLoading,
    heightScale,
    opacity,
    colorScale,
    gridData,
    queryResult,
    loadData,
    rebuildEntities,
    toggleVisibility,
    setOpacity,
    setHeightScale,
    setColorScale,
    flyToLayer,
    queryTemperature,
    destroy,
  }
}
