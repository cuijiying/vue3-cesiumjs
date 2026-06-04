/**
 * 模拟温度格点数据
 * 覆盖中国区域的温度场数据（经度 73°E - 135°E，纬度 18°N - 54°N）
 */

export interface TemperatureGridData {
  /** 经度起点 */
  lonMin: number
  /** 经度终点 */
  lonMax: number
  /** 纬度起点 */
  latMin: number
  /** 纬度终点 */
  latMax: number
  /** 经度方向格点数 */
  cols: number
  /** 纬度方向格点数 */
  rows: number
  /** 温度数据（一维数组，行优先，单位：℃） */
  values: Float32Array
  /** 最小温度 */
  minTemp: number
  /** 最大温度 */
  maxTemp: number
}

/**
 * 生成模拟温度格点数据
 * 使用多个高斯热源 + 纬度梯度 + 随机噪声来模拟真实温度分布
 */
export function generateTemperatureGrid(
  cols: number = 128,
  rows: number = 128,
): TemperatureGridData {
  const lonMin = 73
  const lonMax = 135
  const latMin = 18
  const latMax = 54

  const values = new Float32Array(rows * cols)

  // 定义几个热源中心（模拟高温区域）
  const heatSources = [
    { lon: 110, lat: 23, intensity: 38, radius: 12 },   // 华南高温
    { lon: 115, lat: 30, intensity: 35, radius: 10 },   // 华中
    { lon: 87, lat: 40, intensity: 40, radius: 8 },     // 新疆吐鲁番
    { lon: 120, lat: 35, intensity: 32, radius: 10 },   // 华东
    { lon: 104, lat: 30, intensity: 30, radius: 9 },    // 四川盆地
  ]

  // 定义冷源（模拟低温区域）
  const coldSources = [
    { lon: 91, lat: 32, intensity: -15, radius: 10 },   // 青藏高原
    { lon: 88, lat: 48, intensity: -10, radius: 8 },    // 阿尔泰山
    { lon: 128, lat: 50, intensity: -8, radius: 7 },    // 东北北部
  ]

  let minTemp = Infinity
  let maxTemp = -Infinity

  // 使用伪随机来保证每次生成一致
  function seededRandom(x: number, y: number): number {
    const dot = x * 12.9898 + y * 78.233
    const s = Math.sin(dot) * 43758.5453
    return s - Math.floor(s)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lon = lonMin + (col / (cols - 1)) * (lonMax - lonMin)
      const lat = latMax - (row / (rows - 1)) * (latMax - latMin) // 从北到南

      // 基础温度：纬度梯度（低纬度高温，高纬度低温）
      let temp = 35 - (lat - 18) * 0.8

      // 叠加热源
      for (const source of heatSources) {
        const dx = lon - source.lon
        const dy = lat - source.lat
        const dist2 = dx * dx + dy * dy
        temp += source.intensity * Math.exp(-dist2 / (2 * source.radius * source.radius))
      }

      // 叠加冷源
      for (const source of coldSources) {
        const dx = lon - source.lon
        const dy = lat - source.lat
        const dist2 = dx * dx + dy * dy
        temp += source.intensity * Math.exp(-dist2 / (2 * source.radius * source.radius))
      }

      // 添加噪声
      const noise = (seededRandom(col, row) - 0.5) * 4
      temp += noise

      values[row * cols + col] = temp

      if (temp < minTemp) minTemp = temp
      if (temp > maxTemp) maxTemp = temp
    }
  }

  return {
    lonMin,
    lonMax,
    latMin,
    latMax,
    cols,
    rows,
    values,
    minTemp,
    maxTemp,
  }
}

/**
 * 预定义颜色方案
 */
export const COLOR_SCALES = {
  /** 经典温度色标：蓝 → 青 → 绿 → 黄 → 红 */
  classic: [
    [0.0, 0, 0, 128],     // 深蓝
    [0.15, 0, 0, 255],    // 蓝
    [0.3, 0, 180, 255],   // 青
    [0.45, 0, 255, 128],  // 青绿
    [0.55, 128, 255, 0],  // 黄绿
    [0.7, 255, 255, 0],   // 黄
    [0.85, 255, 128, 0],  // 橙
    [1.0, 255, 0, 0],     // 红
  ] as [number, number, number, number][],

  /** 热力色标：黑 → 紫 → 红 → 黄 → 白 */
  heat: [
    [0.0, 0, 0, 0],
    [0.2, 80, 0, 120],
    [0.4, 180, 0, 60],
    [0.6, 255, 80, 0],
    [0.8, 255, 220, 0],
    [1.0, 255, 255, 255],
  ] as [number, number, number, number][],

  /** 冷暖色标：深蓝 → 白 → 深红 */
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

export type ColorScaleName = keyof typeof COLOR_SCALES
