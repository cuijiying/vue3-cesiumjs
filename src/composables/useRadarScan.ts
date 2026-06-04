import { ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  RADAR_PRESETS,
  computeSectorPositions,
  computeRingPositions,
  isTargetInBeam,
  type RadarTarget,
} from '@/data/radarScan'

const M_PER_DEG = 111000
const TRAIL_SEGMENTS = 5

export function useRadarScan(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  // 响应式状态
  const isAnimating = ref(true)
  const currentHeading = ref(0)
  const speed = ref(60)
  const beamWidth = ref(20)
  const radius = ref(3000)
  const height = ref(150)
  const opacity = ref(0.6)
  const scanColor = ref('#00ff00')
  const trailLength = ref(90)
  const ringCount = ref(5)
  const showCone = ref(true)
  const showRings = ref(true)
  const showTargets = ref(true)
  const showTrail = ref(true)
  const currentPreset = ref(0)

  // 内部变量
  let scanDataSource: Cesium.CustomDataSource | null = null
  let staticDataSource: Cesium.CustomDataSource | null = null
  let targetDataSource: Cesium.CustomDataSource | null = null
  let coneDataSource: Cesium.CustomDataSource | null = null
  let trailEntities: Cesium.Entity[] = []
  let tickRemover: (() => void) | null = null
  let lastTime = 0

  let centerLon = 116.397
  let centerLat = 39.908
  let targets: RadarTarget[] = []

  function init(presetIndex?: number) {
    const viewer = viewerRef.value
    if (!viewer) return

    const idx = presetIndex ?? currentPreset.value
    const preset = RADAR_PRESETS[idx]
    if (!preset) return

    centerLon = preset.params.lon
    centerLat = preset.params.lat
    height.value = preset.params.height
    radius.value = preset.params.radius
    speed.value = preset.params.speed
    beamWidth.value = preset.params.beamWidth
    trailLength.value = preset.params.trailLength
    ringCount.value = preset.params.rings
    targets = preset.targets
    currentHeading.value = 0

    clearEntities(viewer)
    buildEntities(viewer)
    startAnimation(viewer)

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        preset.cameraDestination.lon,
        preset.cameraDestination.lat,
        preset.cameraDestination.height,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0.0,
      },
    })
  }

  function buildEntities(viewer: Cesium.Viewer) {
    scanDataSource = new Cesium.CustomDataSource('radarScan')
    staticDataSource = new Cesium.CustomDataSource('radarStatic')
    targetDataSource = new Cesium.CustomDataSource('radarTargets')
    coneDataSource = new Cesium.CustomDataSource('radarCone')

    viewer.dataSources.add(scanDataSource)
    viewer.dataSources.add(staticDataSource)
    viewer.dataSources.add(targetDataSource)
    viewer.dataSources.add(coneDataSource)

    buildCenterMarker()
    buildScanBeam()
    buildTrail()
    buildCone()
    buildRings()
    buildCrossLines()
    buildTargets()
  }

  function buildCenterMarker() {
    if (!staticDataSource) return

    // 雷达站标记点
    staticDataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height.value),
      point: {
        pixelSize: 12,
        color: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#00ff00'),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: '雷达站',
        font: 'bold 14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    // 地面到雷达的竖直线
    staticDataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          centerLon, centerLat, 0,
          centerLon, centerLat, height.value,
        ]),
        width: 3,
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString('#00ff00').withAlpha(0.8),
        ),
      },
    })
  }

  function buildScanBeam() {
    if (!scanDataSource) return

    const cosLat = Math.cos((centerLat * Math.PI) / 180)

    // 地面扫描扇区（主波束）
    scanDataSource.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const positions = computeSectorPositions(
            centerLon, centerLat,
            radius.value, currentHeading.value, beamWidth.value,
          )
          return new Cesium.PolygonHierarchy(
            positions.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat)),
          )
        }, false),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            return Cesium.Color.fromCssColorString(scanColor.value).withAlpha(opacity.value * 0.5)
          }, false),
        ),
        height: 1,
      },
    })

    // 三维扫描波束面（从雷达顶端到地面边缘的三角面）
    scanDataSource.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          const apex = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height.value)
          const edgePositions: Cesium.Cartesian3[] = []
          const halfBeam = beamWidth.value / 2
          const startAngle = ((currentHeading.value - halfBeam) * Math.PI) / 180
          const endAngle = ((currentHeading.value + halfBeam) * Math.PI) / 180
          const steps = 16

          for (let i = 0; i <= steps; i++) {
            const angle = startAngle + ((endAngle - startAngle) * i) / steps
            const lon = centerLon + (Math.sin(angle) * radius.value) / (M_PER_DEG * cosLat)
            const lat = centerLat + (Math.cos(angle) * radius.value) / M_PER_DEG
            edgePositions.push(Cesium.Cartesian3.fromDegrees(lon, lat, 0))
          }

          return new Cesium.PolygonHierarchy([apex, ...edgePositions])
        }, false),
        perPositionHeight: true,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            return Cesium.Color.fromCssColorString(scanColor.value).withAlpha(opacity.value * 0.3)
          }, false),
        ),
      },
    })

    // 扫描前沿线（从中心到外沿）
    scanDataSource.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const headingRad = (currentHeading.value * Math.PI) / 180
          const edgeLon = centerLon + (Math.sin(headingRad) * radius.value) / (M_PER_DEG * cosLat)
          const edgeLat = centerLat + (Math.cos(headingRad) * radius.value) / M_PER_DEG
          return [
            Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 2),
            Cesium.Cartesian3.fromDegrees(edgeLon, edgeLat, 2),
          ]
        }, false),
        width: 3,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            return Cesium.Color.fromCssColorString(scanColor.value).withAlpha(opacity.value)
          }, false),
        ),
      },
    })

    // 三维扫描前沿线（从雷达顶端到地面外沿）
    scanDataSource.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const headingRad = (currentHeading.value * Math.PI) / 180
          const edgeLon = centerLon + (Math.sin(headingRad) * radius.value) / (M_PER_DEG * cosLat)
          const edgeLat = centerLat + (Math.cos(headingRad) * radius.value) / M_PER_DEG
          return [
            Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height.value),
            Cesium.Cartesian3.fromDegrees(edgeLon, edgeLat, 0),
          ]
        }, false),
        width: 2,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            return Cesium.Color.fromCssColorString(scanColor.value).withAlpha(opacity.value * 0.8)
          }, false),
        ),
      },
    })
  }

  function buildTrail() {
    if (!scanDataSource) return
    trailEntities = []

    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const segmentIndex = i
      const entity = scanDataSource.entities.add({
        polygon: {
          hierarchy: new Cesium.CallbackProperty(() => {
            const segWidth = trailLength.value / TRAIL_SEGMENTS
            const segCenter = currentHeading.value - beamWidth.value / 2 - segWidth * segmentIndex - segWidth / 2

            const positions = computeSectorPositions(
              centerLon, centerLat,
              radius.value, segCenter, segWidth,
            )
            return new Cesium.PolygonHierarchy(
              positions.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat)),
            )
          }, false),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => {
              const alphaFactor = 1 - (segmentIndex + 1) / (TRAIL_SEGMENTS + 1)
              return Cesium.Color.fromCssColorString(scanColor.value).withAlpha(
                opacity.value * 0.35 * alphaFactor,
              )
            }, false),
          ),
          height: 0.5,
        },
      })
      trailEntities.push(entity)
    }
  }

  function buildCone() {
    if (!coneDataSource) return

    coneDataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, height.value / 2),
      cylinder: {
        length: height.value,
        topRadius: 0,
        bottomRadius: radius.value,
        material: Cesium.Color.fromCssColorString(scanColor.value).withAlpha(opacity.value * 0.05),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(scanColor.value).withAlpha(opacity.value * 0.2),
        numberOfVerticalLines: 0,
        slices: 64,
      } as any,
    })
  }

  function buildRings() {
    if (!staticDataSource) return

    const color = Cesium.Color.fromCssColorString(scanColor.value).withAlpha(0.3)

    for (let i = 1; i <= ringCount.value; i++) {
      const ringRadius = (radius.value * i) / ringCount.value
      const positions = computeRingPositions(centerLon, centerLat, ringRadius)

      staticDataSource.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(positions.flat()),
          width: 1,
          material: new Cesium.ColorMaterialProperty(color),
          clampToGround: true,
        },
      })

      // 距离标注
      const labelLon = centerLon
      const labelLat = centerLat + ringRadius / M_PER_DEG
      staticDataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(labelLon, labelLat, 5),
        label: {
          text: `${ringRadius >= 1000 ? (ringRadius / 1000).toFixed(1) + 'km' : ringRadius + 'm'}`,
          font: '11px sans-serif',
          fillColor: Cesium.Color.fromCssColorString(scanColor.value).withAlpha(0.6),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(15, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: 0.9,
        },
      })
    }
  }

  function buildCrossLines() {
    if (!staticDataSource) return

    const cosLat = Math.cos((centerLat * Math.PI) / 180)
    const color = Cesium.Color.fromCssColorString(scanColor.value).withAlpha(0.15)

    for (const dir of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (dir * Math.PI) / 180
      const endLon = centerLon + (Math.sin(rad) * radius.value) / (M_PER_DEG * cosLat)
      const endLat = centerLat + (Math.cos(rad) * radius.value) / M_PER_DEG

      staticDataSource.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            centerLon, centerLat,
            endLon, endLat,
          ]),
          width: 1,
          material: new Cesium.ColorMaterialProperty(color),
          clampToGround: true,
        },
      })
    }
  }

  function buildTargets() {
    if (!targetDataSource) return

    for (const target of targets) {
      const typeColorMap: Record<string, Cesium.Color> = {
        aircraft: Cesium.Color.RED,
        ship: Cesium.Color.CYAN,
        vehicle: Cesium.Color.ORANGE,
        unknown: Cesium.Color.YELLOW,
      }
      const baseColor = typeColorMap[target.type] ?? Cesium.Color.YELLOW

      targetDataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.altitude),
        point: {
          pixelSize: new Cesium.CallbackProperty(() => {
            const inBeam = isTargetInBeam(
              target.lon, target.lat,
              centerLon, centerLat,
              currentHeading.value, beamWidth.value / 2 + trailLength.value * 0.3,
            )
            return inBeam ? 14 : 8
          }, false) as any,
          color: new Cesium.CallbackProperty(() => {
            const inBeam = isTargetInBeam(
              target.lon, target.lat,
              centerLon, centerLat,
              currentHeading.value, beamWidth.value / 2 + trailLength.value * 0.3,
            )
            return inBeam ? baseColor : baseColor.withAlpha(0.3)
          }, false) as any,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: target.label,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          show: new Cesium.CallbackProperty(() => {
            return isTargetInBeam(
              target.lon, target.lat,
              centerLon, centerLat,
              currentHeading.value, beamWidth.value / 2 + trailLength.value * 0.5,
            )
          }, false) as any,
        },
      })
    }
  }

  function startAnimation(viewer: Cesium.Viewer) {
    if (tickRemover) return

    lastTime = performance.now()

    const onTick = () => {
      if (!isAnimating.value) return

      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      currentHeading.value = (currentHeading.value + speed.value * dt) % 360
    }

    viewer.clock.onTick.addEventListener(onTick)
    tickRemover = () => viewer.clock.onTick.removeEventListener(onTick)
  }

  function clearEntities(viewer: Cesium.Viewer) {
    if (tickRemover) {
      tickRemover()
      tickRemover = null
    }
    trailEntities = []

    for (const ds of [scanDataSource, staticDataSource, targetDataSource, coneDataSource]) {
      if (ds) viewer.dataSources.remove(ds, true)
    }
    scanDataSource = null
    staticDataSource = null
    targetDataSource = null
    coneDataSource = null
  }

  function rebuildStaticEntities() {
    const viewer = viewerRef.value
    if (!viewer) return

    if (staticDataSource) {
      staticDataSource.entities.removeAll()
      buildCenterMarker()
      buildRings()
      buildCrossLines()
      staticDataSource.show = showRings.value
    }

    if (coneDataSource) {
      coneDataSource.entities.removeAll()
      buildCone()
      coneDataSource.show = showCone.value
    }
  }

  function toggleAnimation() {
    isAnimating.value = !isAnimating.value
    if (isAnimating.value) {
      lastTime = performance.now()
    }
  }

  function toggleCone() {
    showCone.value = !showCone.value
    if (coneDataSource) coneDataSource.show = showCone.value
  }

  function toggleRings() {
    showRings.value = !showRings.value
    if (staticDataSource) staticDataSource.show = showRings.value
  }

  function toggleTargets() {
    showTargets.value = !showTargets.value
    if (targetDataSource) targetDataSource.show = showTargets.value
  }

  function toggleTrail() {
    showTrail.value = !showTrail.value
    for (const entity of trailEntities) {
      entity.show = showTrail.value
    }
  }

  function switchPreset(index: number) {
    currentPreset.value = index
    init(index)
  }

  function setSpeed(val: number) { speed.value = val }
  function setBeamWidth(val: number) { beamWidth.value = val }
  function setOpacity(val: number) { opacity.value = val; rebuildStaticEntities() }
  function setTrailLength(val: number) { trailLength.value = val }

  function setRadius(val: number) {
    radius.value = val
    rebuildStaticEntities()
  }

  function setHeight(val: number) {
    height.value = val
    rebuildStaticEntities()
  }

  function setRingCount(val: number) {
    ringCount.value = val
    rebuildStaticEntities()
  }

  function setColor(val: string) {
    scanColor.value = val
    rebuildStaticEntities()
  }

  function flyToRadar() {
    const viewer = viewerRef.value
    if (!viewer) return

    const preset = RADAR_PRESETS[currentPreset.value]
    if (!preset) return

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        preset.cameraDestination.lon,
        preset.cameraDestination.lat,
        preset.cameraDestination.height,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0.0,
      },
    })
  }

  function destroy() {
    const viewer = viewerRef.value
    if (viewer) {
      clearEntities(viewer)
    }
  }

  return {
    isAnimating,
    currentHeading,
    speed,
    beamWidth,
    radius,
    height,
    opacity,
    scanColor,
    trailLength,
    ringCount,
    showCone,
    showRings,
    showTargets,
    showTrail,
    currentPreset,
    init,
    toggleAnimation,
    toggleCone,
    toggleRings,
    toggleTargets,
    toggleTrail,
    switchPreset,
    setSpeed,
    setBeamWidth,
    setRadius,
    setHeight,
    setOpacity,
    setTrailLength,
    setRingCount,
    setColor,
    flyToRadar,
    destroy,
  }
}
