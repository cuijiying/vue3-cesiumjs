/**
 * 可视域分析数据与工具函数
 */

/** 观察点参数 */
export interface ViewshedParams {
  /** 观察点经度 */
  lon: number
  /** 观察点纬度 */
  lat: number
  /** 观察点离地高度（米） */
  height: number
  /** 观察方向（度，正北=0，顺时针） */
  heading: number
  /** 俯仰角（度，水平=0，向下为负） */
  pitch: number
  /** 水平视场角（度） */
  fovH: number
  /** 垂直视场角（度） */
  fovV: number
  /** 分析半径（米） */
  radius: number
}

/** 分析结果中的采样点 */
export interface ViewshedSample {
  lon: number
  lat: number
  /** 是否可见 */
  visible: boolean
  /** 距离观察点的距离（米） */
  distance: number
  /** 该点的地面高程（模拟） */
  elevation: number
}

/** 分析结果 */
export interface ViewshedResult {
  params: ViewshedParams
  samples: ViewshedSample[]
  visibleCount: number
  totalCount: number
}

/** 默认观察点参数 */
export const DEFAULT_VIEWSHED_PARAMS: ViewshedParams = {
  lon: 116.4,
  lat: 39.9,
  height: 100,
  heading: 0,
  pitch: -10,
  fovH: 90,
  fovV: 60,
  radius: 2000,
}

/** 预设场景 */
export interface ViewshedPreset {
  name: string
  description: string
  params: ViewshedParams
  /** 地形种子 */
  terrainSeed: number
}

export const VIEWSHED_PRESETS: ViewshedPreset[] = [
  {
    name: '城市监控',
    description: '模拟城市高楼间的监控摄像头可视范围',
    params: {
      lon: 116.397,
      lat: 39.908,
      height: 80,
      heading: 45,
      pitch: -15,
      fovH: 120,
      fovV: 60,
      radius: 1500,
    },
    terrainSeed: 42,
  },
  {
    name: '山顶瞭望',
    description: '模拟山区瞭望塔的可视范围分析',
    params: {
      lon: 116.41,
      lat: 39.92,
      height: 200,
      heading: 0,
      pitch: -5,
      fovH: 360,
      fovV: 40,
      radius: 5000,
    },
    terrainSeed: 99,
  },
  {
    name: '道路监测',
    description: '模拟道路旁监测点的可视范围',
    params: {
      lon: 116.385,
      lat: 39.895,
      height: 30,
      heading: 90,
      pitch: -20,
      fovH: 60,
      fovV: 40,
      radius: 800,
    },
    terrainSeed: 17,
  },
]

/**
 * 基于种子的伪随机数生成器
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * 生成模拟地形高程（简单噪声）
 * 返回函数：(lon, lat) => elevation
 */
export function createTerrainSampler(
  centerLon: number,
  centerLat: number,
  radius: number,
  seed = 42,
): (lon: number, lat: number) => number {
  const rand = seededRandom(seed)

  // 在区域内放置一些"建筑"或"山丘"作为遮挡物
  const obstacles: { lon: number; lat: number; radius: number; height: number }[] = []
  const mPerDeg = 111000
  const degRadius = radius / mPerDeg

  const numObstacles = 15 + Math.floor(rand() * 20)
  for (let i = 0; i < numObstacles; i++) {
    const angle = rand() * Math.PI * 2
    const dist = rand() * degRadius * 0.9
    obstacles.push({
      lon: centerLon + Math.cos(angle) * dist,
      lat: centerLat + Math.sin(angle) * dist,
      radius: (20 + rand() * 80) / mPerDeg,
      height: 10 + rand() * 120,
    })
  }

  return (lon: number, lat: number): number => {
    let maxH = 0
    for (const ob of obstacles) {
      const dx = (lon - ob.lon) * Math.cos((lat * Math.PI) / 180)
      const dy = lat - ob.lat
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < ob.radius) {
        // 越靠近中心越高
        const t = 1 - d / ob.radius
        const h = ob.height * t * t
        if (h > maxH) maxH = h
      }
    }
    return maxH
  }
}

/**
 * 执行可视域分析
 *
 * 从观察点出发，在视场范围内均匀采样，
 * 沿每条射线步进判断是否被地形遮挡。
 */
export function analyzeViewshed(
  params: ViewshedParams,
  terrainSampler: (lon: number, lat: number) => number,
  angularStep = 2,
  distanceSteps = 40,
): ViewshedResult {
  const samples: ViewshedSample[] = []
  const mPerDeg = 111000

  const headingRad = (params.heading * Math.PI) / 180
  const pitchRad = (params.pitch * Math.PI) / 180

  const halfFovH = params.fovH / 2
  const halfFovV = params.fovV / 2

  // 水平角度范围
  const hStart = -halfFovH
  const hEnd = halfFovH
  // 垂直角度范围
  const vStart = -halfFovV
  const vEnd = halfFovV

  const hStepCount = Math.max(1, Math.ceil((hEnd - hStart) / angularStep))
  const actualHStep = (hEnd - hStart) / hStepCount

  for (let hi = 0; hi <= hStepCount; hi++) {
    const hAngleDeg = hStart + hi * actualHStep
    const hAngleRad = (hAngleDeg * Math.PI) / 180

    // 这条射线的水平方位角（绝对）
    const azimuth = headingRad + hAngleRad

    for (let di = 1; di <= distanceSteps; di++) {
      const dist = (di / distanceSteps) * params.radius
      const dLon = (Math.sin(azimuth) * dist) / (mPerDeg * Math.cos((params.lat * Math.PI) / 180))
      const dLat = (Math.cos(azimuth) * dist) / mPerDeg

      const sampleLon = params.lon + dLon
      const sampleLat = params.lat + dLat
      const groundElev = terrainSampler(sampleLon, sampleLat)

      // 判断可见性：沿射线从观察点到目标点，检查中间是否被遮挡
      let visible = true
      const checkSteps = 20
      for (let ci = 1; ci < checkSteps; ci++) {
        const t = ci / checkSteps
        const checkDist = dist * t
        const checkLon = params.lon + dLon * t
        const checkLat = params.lat + dLat * t
        const checkGroundElev = terrainSampler(checkLon, checkLat)

        // 观察点到目标点的直线在当前距离处的高度
        // 考虑俯仰角
        const lineHeight = params.height + Math.tan(pitchRad) * checkDist
        // 插值：观察点高度到目标投影高度
        const sightHeight = params.height + (groundElev - params.height) * t + Math.tan(pitchRad) * checkDist * (1 - t)

        if (checkGroundElev > lineHeight && checkGroundElev > sightHeight) {
          visible = false
          break
        }
      }

      // 还要检查目标点本身的俯仰角是否在视场内
      const targetElevAngle = Math.atan2(groundElev - params.height, dist) * (180 / Math.PI)
      const viewPitchCenter = params.pitch
      if (targetElevAngle < viewPitchCenter - halfFovV || targetElevAngle > viewPitchCenter + halfFovV) {
        // 超出垂直视场范围，不计入
        continue
      }

      samples.push({
        lon: sampleLon,
        lat: sampleLat,
        visible,
        distance: dist,
        elevation: groundElev,
      })
    }
  }

  return {
    params,
    samples,
    visibleCount: samples.filter((s) => s.visible).length,
    totalCount: samples.length,
  }
}
