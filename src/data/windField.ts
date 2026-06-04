/**
 * 模拟风场格点数据
 * 覆盖中国区域（经度 73°E - 135°E，纬度 18°N - 54°N）
 */

export interface WindFieldData {
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
  /** U 分量（东西方向，m/s，正值向东）行优先 */
  uData: Float32Array
  /** V 分量（南北方向，m/s，正值向北）行优先 */
  vData: Float32Array
  /** 最大风速 */
  maxSpeed: number
}

/**
 * 根据经纬度从风场数据中双线性插值获取风速分量
 */
export function interpolateWind(
  data: WindFieldData,
  lon: number,
  lat: number,
): { u: number; v: number } | null {
  const { lonMin, lonMax, latMin, latMax, cols, rows, uData, vData } = data
  if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) return null

  const x = ((lon - lonMin) / (lonMax - lonMin)) * (cols - 1)
  const y = ((latMax - lat) / (latMax - latMin)) * (rows - 1)

  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, cols - 1)
  const y1 = Math.min(y0 + 1, rows - 1)

  const fx = x - x0
  const fy = y - y0

  const u00 = uData[y0 * cols + x0]!
  const u10 = uData[y0 * cols + x1]!
  const u01 = uData[y1 * cols + x0]!
  const u11 = uData[y1 * cols + x1]!

  const v00 = vData[y0 * cols + x0]!
  const v10 = vData[y0 * cols + x1]!
  const v01 = vData[y1 * cols + x0]!
  const v11 = vData[y1 * cols + x1]!

  const u = (1 - fy) * ((1 - fx) * u00 + fx * u10) + fy * ((1 - fx) * u01 + fx * u11)
  const v = (1 - fy) * ((1 - fx) * v00 + fx * v10) + fy * ((1 - fx) * v01 + fx * v11)

  return { u, v }
}

/**
 * 生成模拟风场数据
 * 使用西风带 + 季风 + 气旋 + 高原绕流 + 噪声来模拟中国区域风场
 */
export function generateWindField(cols: number = 64, rows: number = 64): WindFieldData {
  const lonMin = 73
  const lonMax = 135
  const latMin = 18
  const latMax = 54

  const uData = new Float32Array(rows * cols)
  const vData = new Float32Array(rows * cols)
  let maxSpeed = 0

  function seededRandom(x: number, y: number): number {
    const dot = x * 12.9898 + y * 78.233
    const s = Math.sin(dot) * 43758.5453
    return s - Math.floor(s)
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lon = lonMin + (col / (cols - 1)) * (lonMax - lonMin)
      const lat = latMax - (row / (rows - 1)) * (latMax - latMin)

      // 1. 基础西风带（中纬度急流，42°N 附近最强）
      let u = 3 + 12 * Math.exp(-((lat - 42) ** 2) / 80)
      let v = 0

      // 2. 东亚季风（华南华东偏南风）
      if (lon > 100 && lat < 35) {
        const monFactor = Math.exp(-((lon - 113) ** 2 + (lat - 25) ** 2) / 150)
        v += 6 * monFactor
        u -= 2 * monFactor
      }

      // 3. 气旋系统 —— 四川盆地附近低压
      {
        const cx = 105, cy = 32, r = 8
        const dx = lon - cx, dy = lat - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const factor = Math.exp(-(dist * dist) / (r * r)) * 6
        u += (-dy / (dist + 1)) * factor
        v += (dx / (dist + 1)) * factor
      }

      // 4. 气旋系统 —— 渤海附近低压
      {
        const cx = 120, cy = 40, r = 6
        const dx = lon - cx, dy = lat - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        const factor = Math.exp(-(dist * dist) / (r * r)) * 5
        u += (-dy / (dist + 1)) * factor
        v += (dx / (dist + 1)) * factor
      }

      // 5. 青藏高原阻挡绕流
      {
        const cx = 90, cy = 33, rx = 10, ry = 6
        const dx = (lon - cx) / rx, dy = (lat - cy) / ry
        const dist2 = dx * dx + dy * dy
        if (dist2 < 4) {
          const blockFactor = Math.exp(-dist2) * 0.6
          u *= 1 - blockFactor
          v += u * blockFactor * 0.3 * (lat > cy ? 1 : -1)
        }
      }

      // 6. 噪声扰动
      u += (seededRandom(col * 1.1, row * 1.3) - 0.5) * 3
      v += (seededRandom(col * 2.7, row * 0.9) - 0.5) * 2.5
      u += Math.sin(lon * 0.15 + lat * 0.1) * 1.5
      v += Math.cos(lon * 0.12 - lat * 0.08) * 1.2

      const idx = row * cols + col
      uData[idx] = u
      vData[idx] = v

      const speed = Math.sqrt(u * u + v * v)
      if (speed > maxSpeed) maxSpeed = speed
    }
  }

  return { lonMin, lonMax, latMin, latMax, cols, rows, uData, vData, maxSpeed }
}

/** 风速等级颜色方案 */
export const WIND_COLOR_SCALES = {
  rainbow: [
    { threshold: 0, color: [0, 0, 255] },
    { threshold: 0.25, color: [0, 200, 255] },
    { threshold: 0.5, color: [0, 255, 100] },
    { threshold: 0.75, color: [255, 255, 0] },
    { threshold: 1, color: [255, 50, 0] },
  ],
  monochrome: [
    { threshold: 0, color: [100, 100, 100] },
    { threshold: 0.5, color: [200, 200, 200] },
    { threshold: 1, color: [255, 255, 255] },
  ],
  thermal: [
    { threshold: 0, color: [10, 0, 80] },
    { threshold: 0.25, color: [80, 0, 120] },
    { threshold: 0.5, color: [200, 50, 50] },
    { threshold: 0.75, color: [255, 150, 0] },
    { threshold: 1, color: [255, 255, 100] },
  ],
} as const

export type WindColorScaleName = keyof typeof WIND_COLOR_SCALES
