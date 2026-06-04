import { ref, shallowRef, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  M_PER_DEG,
  SCENE_CENTER,
  TWIN_BUILDINGS,
  WEATHER_CELLS,
  FLIGHT_WAYPOINTS,
  WEATHER_SCENARIOS,
  evaluateFlightPlan,
  interpolateAlongRoute,
  riskColor,
  type WeatherScenarioKey,
  type AIDecision,
} from '@/data/lowAltitudeTwin'

/**
 * 低空气象 + 数字孪生 + XR + AI飞行决策 逻辑
 */
export function useLowAltitudeTwin(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  // ---- 响应式状态 ----
  const scenario = ref<WeatherScenarioKey>('lightRain')
  const showBuildings = ref(true)
  const showWind = ref(true)
  const showRain = ref(true)
  const showFog = ref(true)
  const showTurbulence = ref(true)
  const showCorridor = ref(true)
  const showDrone = ref(true)

  const corridorAltitude = ref(120) // 巡航高度（米）
  const droneFlying = ref(false)
  const droneProgress = ref(0) // 0~1
  const droneSpeed = ref(0.04) // 每秒进度

  const xrMode = ref(false)
  const followDrone = ref(false)

  const windSpeed = ref(WEATHER_SCENARIOS.lightRain.windSpeed)
  const windDirection = ref(WEATHER_SCENARIOS.lightRain.windDirection)
  const visibility = ref(WEATHER_SCENARIOS.lightRain.visibility)

  const analyzing = ref(false)
  const aiDecision = shallowRef<AIDecision | null>(null)

  // ---- 内部变量 ----
  let buildingDS: Cesium.CustomDataSource | null = null
  let windDS: Cesium.CustomDataSource | null = null
  let rainDS: Cesium.CustomDataSource | null = null
  let fogDS: Cesium.CustomDataSource | null = null
  let turbDS: Cesium.CustomDataSource | null = null
  let corridorDS: Cesium.CustomDataSource | null = null
  let droneDS: Cesium.CustomDataSource | null = null

  let tickRemover: (() => void) | null = null
  let lastTime = 0
  let pulse = 0

  const cosLat = Math.cos((SCENE_CENTER.lat * Math.PI) / 180)

  function getScenario() {
    return WEATHER_SCENARIOS[scenario.value]
  }

  function recomputeDecision() {
    aiDecision.value = evaluateFlightPlan(getScenario(), corridorAltitude.value)
  }

  function init() {
    const viewer = viewerRef.value
    if (!viewer) return

    viewer.scene.globe.depthTestAgainstTerrain = false
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a1020')

    buildingDS = new Cesium.CustomDataSource('twinBuildings')
    windDS = new Cesium.CustomDataSource('weatherWind')
    rainDS = new Cesium.CustomDataSource('weatherRain')
    fogDS = new Cesium.CustomDataSource('weatherFog')
    turbDS = new Cesium.CustomDataSource('weatherTurb')
    corridorDS = new Cesium.CustomDataSource('flightCorridor')
    droneDS = new Cesium.CustomDataSource('drone')

    viewer.dataSources.add(buildingDS)
    viewer.dataSources.add(fogDS)
    viewer.dataSources.add(rainDS)
    viewer.dataSources.add(turbDS)
    viewer.dataSources.add(windDS)
    viewer.dataSources.add(corridorDS)
    viewer.dataSources.add(droneDS)

    applyScenarioValues()
    buildBuildings()
    buildCorridor()
    buildDrone()
    rebuildWeather()
    recomputeDecision()
    applyVisibility()
    startAnimation(viewer)
    flyToScene()
  }

  function applyScenarioValues() {
    const sc = getScenario()
    windSpeed.value = sc.windSpeed
    windDirection.value = sc.windDirection
    visibility.value = sc.visibility
  }

  // ---- 数字孪生建筑 ----
  function buildBuildings() {
    if (!buildingDS) return
    buildingDS.entities.removeAll()
    for (const b of TWIN_BUILDINGS) {
      buildingDS.entities.add({
        position: Cesium.Cartesian3.fromDegrees(b.lon, b.lat, b.height / 2),
        box: {
          dimensions: new Cesium.Cartesian3(b.width, b.depth, b.height),
          material: Cesium.Color.fromCssColorString('#3a6ea5').withAlpha(0.55),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#7fd3ff').withAlpha(0.7),
        },
      })
      buildingDS.entities.add({
        position: Cesium.Cartesian3.fromDegrees(b.lon, b.lat, b.height + 8),
        label: {
          text: `${b.name}\n${b.height}m`,
          font: '10px sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#aee3ff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance: new Cesium.NearFarScalar(2000, 1.0, 12000, 0.3),
          translucencyByDistance: new Cesium.NearFarScalar(6000, 1.0, 14000, 0.0),
        },
      })
    }
  }

  // ---- 气象要素 ----
  function rebuildWeather() {
    buildWind()
    buildRainFog()
    buildTurbulence()
    applyVisibility()
  }

  function buildWind() {
    if (!windDS) return
    windDS.entities.removeAll()
    const sc = getScenario()
    const flowRad = ((sc.windDirection + 180) * Math.PI) / 180
    const ex = Math.sin(flowRad) // east 分量
    const ny = Math.cos(flowRad) // north 分量
    const length = 70 + sc.windSpeed * 14 // 箭头长度（米）
    const gridN = 6
    const span = 0.011

    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        const lon = SCENE_CENTER.lon - span + (2 * span * i) / (gridN - 1)
        const lat = SCENE_CENTER.lat - span * 0.7 + (2 * span * 0.7 * j) / (gridN - 1)
        const endLon = lon + (ex * length) / (M_PER_DEG * cosLat)
        const endLat = lat + (ny * length) / M_PER_DEG
        windDS.entities.add({
          polyline: {
            positions: new Cesium.CallbackProperty(() => {
              const alt = corridorAltitude.value
              return [
                Cesium.Cartesian3.fromDegrees(lon, lat, alt),
                Cesium.Cartesian3.fromDegrees(endLon, endLat, alt),
              ]
            }, false),
            width: 6,
            material: new Cesium.PolylineArrowMaterialProperty(
              new Cesium.CallbackProperty(() => {
                const a = 0.45 + 0.25 * Math.sin(pulse * 2 + i + j)
                return Cesium.Color.fromCssColorString('#5ad1ff').withAlpha(a)
              }, false),
            ),
          },
        })
      }
    }
  }

  function buildRainFog() {
    if (!rainDS || !fogDS) return
    rainDS.entities.removeAll()
    fogDS.entities.removeAll()
    const sc = getScenario()

    for (const cell of WEATHER_CELLS) {
      if (cell.type === 'rain') {
        const eff = cell.intensity * sc.rainFactor
        if (eff <= 0.01) continue
        const len = cell.top - cell.bottom
        rainDS.entities.add({
          position: Cesium.Cartesian3.fromDegrees(cell.lon, cell.lat, (cell.top + cell.bottom) / 2),
          cylinder: {
            length: len,
            topRadius: cell.radius * 0.85,
            bottomRadius: cell.radius,
            material: Cesium.Color.fromCssColorString('#3aa0ff').withAlpha(0.12 + 0.22 * eff),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#7fc4ff').withAlpha(0.35),
            numberOfVerticalLines: 16,
          },
        })
        rainDS.entities.add({
          position: Cesium.Cartesian3.fromDegrees(cell.lon, cell.lat, cell.top + 30),
          label: {
            text: `🌧️ ${cell.name}`,
            font: '11px sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#aaddff'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          },
        })
      } else if (cell.type === 'fog') {
        const eff = cell.intensity * sc.fogFactor
        if (eff <= 0.01) continue
        fogDS.entities.add({
          position: Cesium.Cartesian3.fromDegrees(cell.lon, cell.lat, (cell.top + cell.bottom) / 2),
          ellipsoid: {
            radii: new Cesium.Cartesian3(cell.radius, cell.radius, (cell.top - cell.bottom) / 2),
            material: Cesium.Color.fromCssColorString('#dfe7ee').withAlpha(0.1 + 0.3 * eff),
          },
        })
        fogDS.entities.add({
          position: Cesium.Cartesian3.fromDegrees(cell.lon, cell.lat, cell.top + 30),
          label: {
            text: `🌫️ ${cell.name}`,
            font: '11px sans-serif',
            fillColor: Cesium.Color.fromCssColorString('#e6eef5'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          },
        })
      }
    }
  }

  function buildTurbulence() {
    if (!turbDS) return
    turbDS.entities.removeAll()
    const sc = getScenario()

    for (const cell of WEATHER_CELLS) {
      if (cell.type !== 'turbulence') continue
      const eff = cell.intensity * sc.turbulenceFactor
      if (eff <= 0.01) continue
      turbDS.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cell.lon, cell.lat, (cell.top + cell.bottom) / 2),
        ellipsoid: {
          radii: new Cesium.CallbackProperty(() => {
            const k = 1 + 0.08 * Math.sin(pulse * 3)
            return new Cesium.Cartesian3(
              cell.radius * k,
              cell.radius * k,
              ((cell.top - cell.bottom) / 2) * k,
            )
          }, false) as any,
          material: Cesium.Color.fromCssColorString('#ff8a3d').withAlpha(0.08 + 0.12 * eff),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('#ffae5c').withAlpha(0.5),
          fill: true,
        },
      })
      turbDS.entities.add({
        position: Cesium.Cartesian3.fromDegrees(cell.lon, cell.lat, cell.top + 30),
        label: {
          text: `🌀 ${cell.name}`,
          font: '11px sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#ffc38f'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        },
      })
    }
  }

  // ---- 飞行走廊（按 AI 风险分段着色）----
  function buildCorridor() {
    if (!corridorDS) return
    corridorDS.entities.removeAll()

    // 分段折线
    for (let i = 0; i < FLIGHT_WAYPOINTS.length - 1; i++) {
      const a = FLIGHT_WAYPOINTS[i]!
      const b = FLIGHT_WAYPOINTS[i + 1]!
      const segIndex = i
      corridorDS.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            const alt = corridorAltitude.value
            return [
              Cesium.Cartesian3.fromDegrees(a.lon, a.lat, alt),
              Cesium.Cartesian3.fromDegrees(b.lon, b.lat, alt),
            ]
          }, false),
          width: 8,
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => {
              const seg = aiDecision.value?.segments[segIndex]
              const css = seg ? riskColor(seg.level) : '#00e676'
              return Cesium.Color.fromCssColorString(css).withAlpha(0.9)
            }, false),
          ),
        },
      })
    }

    // 航点标记与垂直引导线
    for (const wp of FLIGHT_WAYPOINTS) {
      corridorDS.entities.add({
        position: new Cesium.CallbackProperty(
          () => Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, corridorAltitude.value),
          false,
        ) as any,
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#ffffff'),
          outlineColor: Cesium.Color.fromCssColorString('#00d4ff'),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: wp.name,
          font: '11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      // 到地面的引导虚线
      corridorDS.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            return [
              Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, 0),
              Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, corridorAltitude.value),
            ]
          }, false),
          width: 1,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#00d4ff').withAlpha(0.4),
          }),
        },
      })
    }
  }

  // ---- 无人机 ----
  function buildDrone() {
    if (!droneDS) return
    droneDS.entities.removeAll()

    const dronePos = () => {
      const p = interpolateAlongRoute(FLIGHT_WAYPOINTS, droneProgress.value)
      return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, corridorAltitude.value)
    }

    droneDS.entities.add({
      position: new Cesium.CallbackProperty(dronePos, false) as any,
      point: {
        pixelSize: 16,
        color: Cesium.Color.fromCssColorString('#00ffd5'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: new Cesium.CallbackProperty(() => {
          return `🚁 UAV-01  ${corridorAltitude.value}m`
        }, false) as any,
        font: 'bold 12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#00ffd5'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })

    // 旋翼光环
    droneDS.entities.add({
      position: new Cesium.CallbackProperty(dronePos, false) as any,
      ellipse: {
        semiMajorAxis: new Cesium.CallbackProperty(() => 25 + 6 * Math.sin(pulse * 6), false) as any,
        semiMinorAxis: new Cesium.CallbackProperty(() => 25 + 6 * Math.sin(pulse * 6), false) as any,
        height: new Cesium.CallbackProperty(() => corridorAltitude.value, false) as any,
        material: Cesium.Color.fromCssColorString('#00ffd5').withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#00ffd5').withAlpha(0.5),
      },
    })

    // 到地面的投影线
    droneDS.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const p = interpolateAlongRoute(FLIGHT_WAYPOINTS, droneProgress.value)
          return [
            Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0),
            Cesium.Cartesian3.fromDegrees(p.lon, p.lat, corridorAltitude.value),
          ]
        }, false),
        width: 1,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#00ffd5').withAlpha(0.5),
        }),
      },
    })
  }

  // ---- 图层显隐 ----
  function applyVisibility() {
    if (buildingDS) buildingDS.show = showBuildings.value
    if (windDS) windDS.show = showWind.value
    if (rainDS) rainDS.show = showRain.value
    if (fogDS) fogDS.show = showFog.value
    if (turbDS) turbDS.show = showTurbulence.value
    if (corridorDS) corridorDS.show = showCorridor.value
    if (droneDS) droneDS.show = showDrone.value
  }

  // ---- 动画与相机 ----
  function startAnimation(viewer: Cesium.Viewer) {
    if (tickRemover) return
    lastTime = performance.now()

    const onTick = () => {
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now
      pulse += dt

      if (droneFlying.value) {
        droneProgress.value += droneSpeed.value * dt
        if (droneProgress.value >= 1) {
          droneProgress.value = 0 // 循环巡航
        }
      }

      if (followDrone.value) {
        updateChaseCamera(viewer)
      }
    }

    viewer.clock.onTick.addEventListener(onTick)
    tickRemover = () => viewer.clock.onTick.removeEventListener(onTick)
  }

  function updateChaseCamera(viewer: Cesium.Viewer) {
    const p = interpolateAlongRoute(FLIGHT_WAYPOINTS, droneProgress.value)
    const ahead = interpolateAlongRoute(
      FLIGHT_WAYPOINTS,
      Math.min(1, droneProgress.value + 0.01),
    )
    const heading = Math.atan2(
      (ahead.lon - p.lon) * cosLat,
      ahead.lat - p.lat,
    )
    // 相机置于无人机后上方
    const back = 180
    const camLon = p.lon - (Math.sin(heading) * back) / (M_PER_DEG * cosLat)
    const camLat = p.lat - (Math.cos(heading) * back) / M_PER_DEG
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(camLon, camLat, corridorAltitude.value + 60),
      orientation: {
        heading,
        pitch: Cesium.Math.toRadians(-12),
        roll: 0,
      },
    })
  }

  function flyToScene() {
    const viewer = viewerRef.value
    if (!viewer) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        SCENE_CENTER.lon + 0.004,
        SCENE_CENTER.lat - 0.03,
        2600,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0,
      },
    })
  }

  // ---- 对外方法 ----
  function switchScenario(key: WeatherScenarioKey) {
    scenario.value = key
    applyScenarioValues()
    rebuildWeather()
    recomputeDecision()
  }

  function setCorridorAltitude(v: number) {
    corridorAltitude.value = v
    recomputeDecision()
  }

  function toggleDroneFlight() {
    droneFlying.value = !droneFlying.value
  }

  function setDroneProgress(v: number) {
    droneProgress.value = Math.max(0, Math.min(1, v))
  }

  function toggleXR() {
    const viewer = viewerRef.value
    if (!viewer) return
    xrMode.value = !xrMode.value
    viewer.scene.useWebVR = xrMode.value
  }

  function toggleFollowDrone() {
    const viewer = viewerRef.value
    followDrone.value = !followDrone.value
    if (!followDrone.value && viewer) {
      flyToScene()
    }
  }

  function toggleLayer(layer: 'buildings' | 'wind' | 'rain' | 'fog' | 'turbulence' | 'corridor' | 'drone') {
    const map = {
      buildings: showBuildings,
      wind: showWind,
      rain: showRain,
      fog: showFog,
      turbulence: showTurbulence,
      corridor: showCorridor,
      drone: showDrone,
    }
    map[layer].value = !map[layer].value
    applyVisibility()
  }

  /** 触发 AI 分析（带短暂"计算中"动效） */
  function runAIAnalysis() {
    analyzing.value = true
    window.setTimeout(() => {
      recomputeDecision()
      analyzing.value = false
    }, 700)
  }

  /** 采用 AI 建议高度 */
  function adoptSuggestedAltitude() {
    if (aiDecision.value) {
      setCorridorAltitude(aiDecision.value.suggestedAltitude)
    }
  }

  function destroy() {
    const viewer = viewerRef.value
    if (tickRemover) {
      tickRemover()
      tickRemover = null
    }
    if (viewer) {
      if (xrMode.value) viewer.scene.useWebVR = false
      ;[buildingDS, windDS, rainDS, fogDS, turbDS, corridorDS, droneDS].forEach((ds) => {
        if (ds) viewer.dataSources.remove(ds, true)
      })
    }
    buildingDS = windDS = rainDS = fogDS = turbDS = corridorDS = droneDS = null
  }

  return {
    // 状态
    scenario,
    showBuildings,
    showWind,
    showRain,
    showFog,
    showTurbulence,
    showCorridor,
    showDrone,
    corridorAltitude,
    droneFlying,
    droneProgress,
    xrMode,
    followDrone,
    windSpeed,
    windDirection,
    visibility,
    analyzing,
    aiDecision,
    // 方法
    init,
    switchScenario,
    setCorridorAltitude,
    toggleDroneFlight,
    setDroneProgress,
    toggleXR,
    toggleFollowDrone,
    toggleLayer,
    runAIAnalysis,
    adoptSuggestedAltitude,
    flyToScene,
    destroy,
  }
}
