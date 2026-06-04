/**
 * 三维温度格点数据
 * 覆盖中国区域，温度越高柱体越高
 */

export interface TemperatureGrid3DData {
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  cols: number
  rows: number
  /** 温度值（一维数组，行优先，单位：℃） */
  values: Float32Array
  minTemp: number
  maxTemp: number
}

/**
 * 色标定义：[归一化位置, R, G, B]
 */
export const TEMP3D_COLOR_SCALES = {
  classic: [
    [0.0, 0, 0, 128],
    [0.15, 0, 0, 255],
    [0.3, 0, 180, 255],
    [0.45, 0, 255, 128],
    [0.55, 128, 255, 0],
    [0.7, 255, 255, 0],
    [0.85, 255, 128, 0],
    [1.0, 255, 0, 0],
  ] as [number, number, number, number][],

  heat: [
    [0.0, 0, 0, 0],
    [0.2, 80, 0, 120],
    [0.4, 180, 0, 60],
    [0.6, 255, 80, 0],
    [0.8, 255, 220, 0],
    [1.0, 255, 255, 255],
  ] as [number, number, number, number][],

  diverging: [
    [0.0, 0, 0, 180],
    [0.25, 80, 140, 255],
    [0.45, 200, 220, 255],
    [0.5, 245, 245, 245],
    [0.55, 255, 220, 200],
    [0.75, 255, 100, 60],
    [1.0, 180, 0, 0],
  ] as [number, number, number, number][],
} as const

export type Temp3DColorScaleName = keyof typeof TEMP3D_COLOR_SCALES

/**
 * 根据归一化值和色标插值得到 RGB 颜色
 */
export function interpolateColor(
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
 * 生成模拟温度格点数据（较粗分辨率，用于三维柱状图）
 */
export function generateTemperatureGrid3D(
  cols: number = 32,
  rows: number = 32,
): TemperatureGrid3DData {
  const lonMin = 73
  const lonMax = 135
  const latMin = 18
  const latMax = 54

  const values = new Float32Array(rows * cols)

  const heatSources = [
    { lon: 110, lat: 23, intensity: 38, radius: 12 },
    { lon: 115, lat: 30, intensity: 35, radius: 10 },
    { lon: 87, lat: 40, intensity: 40, radius: 8 },
    { lon: 120, lat: 35, intensity: 32, radius: 10 },
    { lon: 104, lat: 30, intensity: 30, radius: 9 },
  ]

  const coldSources = [
    { lon: 91, lat: 32, intensity: -15, radius: 10 },
    { lon: 88, lat: 48, intensity: -10, radius: 8 },
    { lon: 128, lat: 50, intensity: -8, radius: 7 },
  ]

  let minTemp = Infinity
  let maxTemp = -Infinity

  function seededRandom(x: number, y: number): number {
    const dot = x * 12.9898 + y * 78.233
    const s = Math.sin(dot) * 43758.5453
    return s - Math.floor(s)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lon = lonMin + (col / (cols - 1)) * (lonMax - lonMin)
      const lat = latMax - (row / (rows - 1)) * (latMax - latMin)

      let temp = 35 - (lat - 18) * 0.8

      for (const source of heatSources) {
        const dx = lon - source.lon
        const dy = lat - source.lat
        const dist2 = dx * dx + dy * dy
        temp += source.intensity * Math.exp(-dist2 / (2 * source.radius * source.radius))
      }

      for (const source of coldSources) {
        const dx = lon - source.lon
        const dy = lat - source.lat
        const dist2 = dx * dx + dy * dy
        temp += source.intensity * Math.exp(-dist2 / (2 * source.radius * source.radius))
      }

      const noise = (seededRandom(col, row) - 0.5) * 4
      temp += noise

      values[row * cols + col] = temp

      if (temp < minTemp) minTemp = temp
      if (temp > maxTemp) maxTemp = temp
    }
  }

  return { lonMin, lonMax, latMin, latMax, cols, rows, values, minTemp, maxTemp }
}
