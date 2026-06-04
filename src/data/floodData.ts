/**
 * 淹没分析数据
 * 模拟某区域的地形高程，用于水位淹没模拟
 */

export interface FloodTerrainData {
  /** 经度范围 */
  lonMin: number
  lonMax: number
  /** 纬度范围 */
  latMin: number
  latMax: number
  /** 列数 */
  cols: number
  /** 行数 */
  rows: number
  /** 高程值（一维数组，行优先，单位：米） */
  values: Float32Array
  /** 最低高程 */
  minElev: number
  /** 最高高程 */
  maxElev: number
}

export interface FloodPreset {
  name: string
  description: string
  center: { lon: number; lat: number; height: number }
  waterLevel: number
  range: { lonMin: number; lonMax: number; latMin: number; latMax: number }
}

/** 预设场景 */
export const FLOOD_PRESETS: FloodPreset[] = [
  {
    name: '河谷盆地',
    description: '模拟河谷区域洪水淹没，河道两侧地势较高',
    center: { lon: 116.4, lat: 30.5, height: 80000 },
    waterLevel: 50,
    range: { lonMin: 115.8, lonMax: 117.0, latMin: 30.0, latMax: 31.0 },
  },
  {
    name: '沿海低地',
    description: '模拟海平面上升对沿海低地的淹没影响',
    center: { lon: 121.5, lat: 31.2, height: 60000 },
    waterLevel: 10,
    range: { lonMin: 121.0, lonMax: 122.0, latMin: 30.8, latMax: 31.6 },
  },
  {
    name: '山区水库',
    description: '模拟山区水库蓄水后的淹没范围',
    center: { lon: 103.8, lat: 29.5, height: 100000 },
    waterLevel: 200,
    range: { lonMin: 103.2, lonMax: 104.4, latMin: 29.0, latMax: 30.0 },
  },
]

/**
 * 水面颜色配置
 */
export const WATER_COLORS = {
  blue: { r: 30, g: 100, b: 220, label: '蓝色' },
  cyan: { r: 0, g: 180, b: 200, label: '青色' },
  dark: { r: 20, g: 60, b: 120, label: '深蓝' },
} as const

export type WaterColorName = keyof typeof WATER_COLORS

/**
 * 生成模拟地形数据
 * 使用多个正弦/余弦叠加模拟真实地形起伏
 */
export function generateFloodTerrain(preset: FloodPreset, cols = 60, rows = 60): FloodTerrainData {
  const { lonMin, lonMax, latMin, latMax } = preset.range
  const values = new Float32Array(cols * rows)
  let minElev = Infinity
  let maxElev = -Infinity

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = col / (cols - 1)
      const ny = row / (rows - 1)

      let elev = 0

      if (preset.name === '河谷盆地') {
        // 河谷：中间低、两侧高
        const distCenter = Math.abs(ny - 0.5) * 2
        elev = 20 + distCenter * distCenter * 200
        // 沿河道方向的起伏
        elev += Math.sin(nx * Math.PI * 3) * 15
        elev += Math.cos(ny * Math.PI * 4 + nx * 2) * 12
        // 增加随机噪声
        elev += Math.sin(nx * 17.3 + ny * 23.7) * 8
        elev += Math.cos(nx * 31.1 + ny * 11.3) * 5
      } else if (preset.name === '沿海低地') {
        // 沿海：东低西高，整体较低
        elev = nx * 30 + 2
        elev += Math.sin(ny * Math.PI * 5) * 4
        elev += Math.cos(nx * Math.PI * 3 + ny * 2) * 3
        elev += Math.sin(nx * 13.7 + ny * 19.3) * 2
      } else if (preset.name === '山区水库') {
        // 山区：中间凹陷的盆地，四周高山
        const cx = nx - 0.5
        const cy = ny - 0.5
        const dist = Math.sqrt(cx * cx + cy * cy)
        elev = 80 + dist * dist * 1600
        // 加入山脊
        elev += Math.sin(Math.atan2(cy, cx) * 3) * 40 * dist
        elev += Math.cos(nx * Math.PI * 6) * 20
        elev += Math.sin(ny * Math.PI * 5) * 18
        elev += Math.sin(nx * 11.1 + ny * 17.7) * 10
      }

      values[row * cols + col] = elev
      if (elev < minElev) minElev = elev
      if (elev > maxElev) maxElev = elev
    }
  }

  return { lonMin, lonMax, latMin, latMax, cols, rows, values, minElev, maxElev }
}

/**
 * 计算淹没统计
 */
export function computeFloodStats(terrain: FloodTerrainData, waterLevel: number) {
  const total = terrain.cols * terrain.rows
  let floodedCount = 0
  let maxDepth = 0
  let totalDepth = 0

  for (let i = 0; i < total; i++) {
    const elev = terrain.values[i]!
    if (elev <= waterLevel) {
      floodedCount++
      const depth = waterLevel - elev
      if (depth > maxDepth) maxDepth = depth
      totalDepth += depth
    }
  }

  const floodedRatio = floodedCount / total
  const avgDepth = floodedCount > 0 ? totalDepth / floodedCount : 0

  // 估算淹没面积（km²）
  const areaLon = (terrain.lonMax - terrain.lonMin) * 111 * Math.cos(((terrain.latMin + terrain.latMax) / 2 * Math.PI) / 180)
  const areaLat = (terrain.latMax - terrain.latMin) * 111
  const totalArea = areaLon * areaLat
  const floodedArea = totalArea * floodedRatio

  return {
    floodedRatio,
    floodedArea: Math.round(floodedArea * 100) / 100,
    totalArea: Math.round(totalArea * 100) / 100,
    maxDepth: Math.round(maxDepth * 100) / 100,
    avgDepth: Math.round(avgDepth * 100) / 100,
    floodedCount,
    totalCount: total,
  }
}
