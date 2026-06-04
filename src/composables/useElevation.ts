import { ref, shallowRef, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  generateElevationGrid,
  interpolateElevColor,
  ELEVATION_COLOR_SCALES,
  type ElevationGridData,
  type ElevationColorScaleName,
} from '@/data/elevationData'

export function useElevation(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  const isVisible = ref(true)
  const isLoading = ref(false)
  const heightScale = ref(30)
  const opacity = ref(0.9)
  const colorScale = ref<ElevationColorScaleName>('terrain')
  const gridData = shallowRef<ElevationGridData | null>(null)
  const queryResult = ref<{ lon: number; lat: number; elev: number } | null>(null)
  const showLabels = ref(false)

  let dataSource: Cesium.CustomDataSource | null = null
  let labelDataSource: Cesium.CustomDataSource | null = null

  function loadData(cols = 48, rows = 36) {
    isLoading.value = true
    gridData.value = generateElevationGrid(cols, rows)
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
    if (labelDataSource) {
      viewer.dataSources.remove(labelDataSource, true)
    }

    dataSource = new Cesium.CustomDataSource('elevationGrid')
    viewer.dataSources.add(dataSource)
    labelDataSource = new Cesium.CustomDataSource('elevationLabels')
    viewer.dataSources.add(labelDataSource)

    const { lonMin, lonMax, latMin, latMax, cols, rows, values, minElev, maxElev } = data
    const range = maxElev - minElev || 1
    const stops = ELEVATION_COLOR_SCALES[colorScale.value]
    const lonStep = (lonMax - lonMin) / (cols - 1)
    const latStep = (latMax - latMin) / (rows - 1)
    const boxLonSize = lonStep * 0.85
    const boxLatSize = latStep * 0.85

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lon = lonMin + col * lonStep
        const lat = latMax - row * latStep
        const elev = values[row * cols + col]!
        const t = (elev - minElev) / range
        // 柱体高度 = 高程值 * 夸张系数，保证最低也有一定高度
        const height = Math.max(2000, elev * heightScale.value * 0.5)
        const [r, g, b] = interpolateElevColor(t, stops)

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
            elevation: elev,
            longitude: lon,
            latitude: lat,
          } as any,
        })

        // 在高点上添加高程标注
        if (showLabels.value && elev > (maxElev * 0.6)) {
          labelDataSource.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, height + 5000),
            label: {
              text: `${Math.round(elev)}m`,
              font: '12px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -5),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scaleByDistance: new Cesium.NearFarScalar(1e5, 1.0, 1e7, 0.3),
            },
          })
        }
      }
    }

    dataSource.show = isVisible.value
    labelDataSource.show = isVisible.value && showLabels.value
  }

  function toggleVisibility() {
    isVisible.value = !isVisible.value
    if (dataSource) dataSource.show = isVisible.value
    if (labelDataSource) labelDataSource.show = isVisible.value && showLabels.value
  }

  function toggleLabels() {
    showLabels.value = !showLabels.value
    rebuildEntities()
  }

  function setOpacity(val: number) {
    opacity.value = val
    rebuildEntities()
  }

  function setHeightScale(val: number) {
    heightScale.value = val
    rebuildEntities()
  }

  function setColorScale(name: ElevationColorScaleName) {
    colorScale.value = name
    rebuildEntities()
  }

  function flyToLayer() {
    const viewer = viewerRef.value
    if (!viewer) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(95, 25, 8000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })
  }

  function queryElevation(lon: number, lat: number): number | null {
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
    if (viewer) {
      if (dataSource) {
        viewer.dataSources.remove(dataSource, true)
        dataSource = null
      }
      if (labelDataSource) {
        viewer.dataSources.remove(labelDataSource, true)
        labelDataSource = null
      }
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
    showLabels,
    loadData,
    rebuildEntities,
    toggleVisibility,
    toggleLabels,
    setOpacity,
    setHeightScale,
    setColorScale,
    flyToLayer,
    queryElevation,
    destroy,
  }
}
