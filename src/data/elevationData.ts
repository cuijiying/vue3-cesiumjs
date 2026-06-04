/**
 * 高程格点数据
 * 覆盖中国区域，模拟地形高度
 */

export interface ElevationGridData {
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  cols: number
  rows: number
  /** 高程值（一维数组，行优先，单位：米） */
  values: Float32Array
  minElev: number
  maxElev: number
}

/**
 * 色标定义：[归一化位置, R, G, B]
 */
export const ELEVATION_COLOR_SCALES = {
  terrain: [
    [0.0, 0, 97, 0],
    [0.1, 16, 122, 0],
    [0.2, 56, 168, 0],
    [0.3, 128, 190, 64],
    [0.4, 186, 210, 100],
    [0.5, 220, 200, 130],
    [0.6, 190, 160, 100],
    [0.7, 160, 120, 80],
    [0.8, 130, 100, 70],
    [0.9, 200, 200, 200],
    [1.0, 255, 255, 255],
  ] as [number, number, number, number][],

  viridis: [
    [0.0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1.0, 253, 231, 37],
  ] as [number, number, number, number][],

  bathymetry: [
    [0.0, 0, 50, 0],
    [0.15, 0, 128, 0],
    [0.3, 110, 180, 50],
    [0.45, 200, 200, 80],
    [0.6, 200, 160, 60],
    [0.75, 160, 100, 50],
    [0.85, 120, 80, 60],
    [0.95, 220, 220, 220],
    [1.0, 255, 255, 255],
  ] as [number, number, number, number][],
} as const

export type ElevationColorScaleName = keyof typeof ELEVATION_COLOR_SCALES

/**
 * 根据归一化值和色标插值得到 RGB
 */
export function interpolateElevColor(
  t: number,
  stops: readonly [number, number, number, number][],
): [number, number, number] {
  t = Math.max(0, Math.min(1, t))
  let lo = 0
  let hi = stops.length - 1
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i]![0] && t <= stops[i + 1]![0]) {
      lo = i
      hi = i + 1
      break
    }
  }
  const sLo = stops[lo]!
  const sHi = stops[hi]!
  const range = sHi[0] - sLo[0] || 1
  const f = (t - sLo[0]) / range
  return [
    Math.round(sLo[1] + (sHi[1] - sLo[1]) * f),
    Math.round(sLo[2] + (sHi[2] - sLo[2]) * f),
    Math.round(sLo[3] + (sHi[3] - sLo[3]) * f),
  ]
}

/**
 * 生成模拟高程格点数据
 * 包含青藏高原、天山、秦岭、华北平原、东南丘陵等典型地形
 */
export function generateElevationGrid(
  cols: number = 48,
  rows: number = 36,
): ElevationGridData {
  const lonMin = 73
  const lonMax = 135
  const latMin = 18
  const latMax = 54

  const values = new Float32Array(rows * cols)

  // 高原/山脉模拟
  const elevSources = [
    // 青藏高原（大范围高海拔）
    { lon: 88, lat: 33, intensity: 4800, radiusX: 14, radiusY: 8 },
    { lon: 81, lat: 35, intensity: 5200, radiusX: 6, radiusY: 5 },
    // 喜马拉雅山脉
    { lon: 86, lat: 28, intensity: 6500, radiusX: 8, radiusY: 3 },
    // 天山山脉
    { lon: 82, lat: 42, intensity: 4000, radiusX: 10, radiusY: 3 },
    // 秦岭
    { lon: 108, lat: 34, intensity: 2500, radiusX: 8, radiusY: 2 },
    // 太行山
    { lon: 114, lat: 38, intensity: 1800, radiusX: 3, radiusY: 6 },
    // 大兴安岭
    { lon: 122, lat: 48, intensity: 1200, radiusX: 3, radiusY: 7 },
    // 云贵高原
    { lon: 103, lat: 26, intensity: 2200, radiusX: 6, radiusY: 5 },
    // 横断山脉
    { lon: 99, lat: 28, intensity: 3800, radiusX: 4, radiusY: 6 },
    // 祁连山
    { lon: 98, lat: 38, intensity: 3500, radiusX: 6, radiusY: 3 },
    // 南岭
    { lon: 112, lat: 25, intensity: 1200, radiusX: 6, radiusY: 2 },
    // 长白山
    { lon: 128, lat: 42, intensity: 1500, radiusX: 3, radiusY: 3 },
    // 武夷山
    { lon: 118, lat: 27, intensity: 1100, radiusX: 3, radiusY: 4 },
  ]

  // 平原（负偏置使高度较低）
  const plains = [
    // 华北平原
    { lon: 116, lat: 36, intensity: -200, radiusX: 6, radiusY: 6 },
    // 东北平原
    { lon: 125, lat: 46, intensity: -150, radiusX: 5, radiusY: 6 },
    // 长江中下游平原
    { lon: 117, lat: 31, intensity: -180, radiusX: 6, radiusY: 3 },
  ]

  let minElev = Infinity
  let maxElev = -Infinity

  function seededRandom(x: number, y: number): number {
    const dot = x * 12.9898 + y * 78.233
    const s = Math.sin(dot) * 43758.5453
    return s - Math.floor(s)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lon = lonMin + (col / (cols - 1)) * (lonMax - lonMin)
      const lat = latMax - (row / (rows - 1)) * (latMax - latMin)

      // 基础高度：中国西高东低
      let elev = 200 + Math.max(0, (100 - lon) * 30)

      // 叠加山脉/高原
      for (const s of elevSources) {
        const dx = (lon - s.lon) / s.radiusX
        const dy = (lat - s.lat) / s.radiusY
        const dist2 = dx * dx + dy * dy
        elev += s.intensity * Math.exp(-dist2 / 2)
      }

      // 叠加平原（降低高度）
      for (const p of plains) {
        const dx = (lon - p.lon) / p.radiusX
        const dy = (lat - p.lat) / p.radiusY
        const dist2 = dx * dx + dy * dy
        elev += p.intensity * Math.exp(-dist2 / 2)
      }

      // 添加细节噪声
      const noise = (seededRandom(col, row) - 0.5) * 200
      elev += noise

      // 确保最低不低于0
      elev = Math.max(0, elev)

      values[row * cols + col] = elev

      if (elev < minElev) minElev = elev
      if (elev > maxElev) maxElev = elev
    }
  }

  return { lonMin, lonMax, latMin, latMax, cols, rows, values, minElev, maxElev }
}
