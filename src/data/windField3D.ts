/**
 * 三维风场格点数据
 * 覆盖中国区域（经度 73°E - 135°E，纬度 18°N - 54°N）
 * 包含多个高度层的 U/V/W 风速分量
 */

export interface WindField3DData {
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  cols: number
  rows: number
  /** 各高度层海拔 (m) */
  levels: number[]
  /** U 分量 [level][row * cols + col]（东西方向，m/s，正值向东） */
  uData: Float32Array[]
  /** V 分量 [level][row * cols + col]（南北方向，m/s，正值向北） */
  vData: Float32Array[]
  /** W 分量 [level][row * cols + col]（垂直方向，m/s，正值向上） */
  wData: Float32Array[]
  maxSpeed: number
}

/**
 * 三线性插值获取 3D 风速分量
 */
export function interpolateWind3D(
  data: WindField3DData,
  lon: number,
  lat: number,
  alt: number,
): { u: number; v: number; w: number } | null {
  const { lonMin, lonMax, latMin, latMax, cols, rows, levels, uData, vData, wData } = data
  if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) return null
  if (alt < levels[0]! || alt > levels[levels.length - 1]!) return null

  // 水平插值坐标
  const x = ((lon - lonMin) / (lonMax - lonMin)) * (cols - 1)
  const y = ((latMax - lat) / (latMax - latMin)) * (rows - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, cols - 1)
  const y1 = Math.min(y0 + 1, rows - 1)
  const fx = x - x0
  const fy = y - y0

  // 高度层插值
  let lv0 = 0
  for (let i = 0; i < levels.length - 1; i++) {
    if (alt >= levels[i]! && alt <= levels[i + 1]!) {
      lv0 = i
      break
    }
  }
  const lv1 = Math.min(lv0 + 1, levels.length - 1)
  const fz = lv0 === lv1 ? 0 : (alt - levels[lv0]!) / (levels[lv1]! - levels[lv0]!)

  function bilinear(arr: Float32Array): number {
    const v00 = arr[y0 * cols + x0]!
    const v10 = arr[y0 * cols + x1]!
    const v01 = arr[y1 * cols + x0]!
    const v11 = arr[y1 * cols + x1]!
    return (1 - fy) * ((1 - fx) * v00 + fx * v10) + fy * ((1 - fx) * v01 + fx * v11)
  }

  const uLo = bilinear(uData[lv0]!)
  const uHi = bilinear(uData[lv1]!)
  const vLo = bilinear(vData[lv0]!)
  const vHi = bilinear(vData[lv1]!)
  const wLo = bilinear(wData[lv0]!)
  const wHi = bilinear(wData[lv1]!)

  return {
    u: uLo + (uHi - uLo) * fz,
    v: vLo + (vHi - vLo) * fz,
    w: wLo + (wHi - wLo) * fz,
  }
}

/**
 * 生成模拟三维风场数据
 * 多个高度层，含垂直分量（上升下沉气流）
 */
export function generateWindField3D(
  cols = 36,
  rows = 36,
  levelHeights: number[] = [1000, 3000, 5000, 8000, 12000],
): WindField3DData {
  const lonMin = 73
  const lonMax = 135
  const latMin = 18
  const latMax = 54

  const uData: Float32Array[] = []
  const vData: Float32Array[] = []
  const wData: Float32Array[] = []
  let maxSpeed = 0

  function seededRandom(x: number, y: number): number {
    const dot = x * 12.9898 + y * 78.233
    const s = Math.sin(dot) * 43758.5453
    return s - Math.floor(s)
  }

  for (let lv = 0; lv < levelHeights.length; lv++) {
    const alt = levelHeights[lv]!
    const altFactor = alt / 12000 // 0~1 归一化高度因子
    const u = new Float32Array(rows * cols)
    const v = new Float32Array(rows * cols)
    const w = new Float32Array(rows * cols)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lon = lonMin + (col / (cols - 1)) * (lonMax - lonMin)
        const lat = latMax - (row / (rows - 1)) * (latMax - latMin)

        // 1. 基础西风带（高空急流更强）
        let uVal = (3 + 18 * altFactor) * Math.exp(-((lat - 42) ** 2) / 80)
        let vVal = 0
        let wVal = 0

        // 2. 东亚季风（低层偏南风，高层偏北风）
        if (lon > 100 && lat < 35) {
          const monFactor = Math.exp(-((lon - 113) ** 2 + (lat - 25) ** 2) / 150)
          const monSign = altFactor < 0.4 ? 1 : -0.5
          vVal += 6 * monFactor * monSign
          uVal -= 2 * monFactor
        }

        // 3. 四川盆地低压气旋
        {
          const cx = 105, cy = 32, r = 8
          const dx = lon - cx, dy = lat - cy
          const dist = Math.sqrt(dx * dx + dy * dy)
          const factor = Math.exp(-(dist * dist) / (r * r)) * 6 * (1 - altFactor * 0.5)
          uVal += (-dy / (dist + 1)) * factor
          vVal += (dx / (dist + 1)) * factor
          // 气旋中心有上升运动
          wVal += Math.exp(-(dist * dist) / (r * r * 0.5)) * 2.0 * (1 - altFactor)
        }

        // 4. 渤海气旋
        {
          const cx = 120, cy = 40, r = 6
          const dx = lon - cx, dy = lat - cy
          const dist = Math.sqrt(dx * dx + dy * dy)
          const factor = Math.exp(-(dist * dist) / (r * r)) * 5 * (1 - altFactor * 0.4)
          uVal += (-dy / (dist + 1)) * factor
          vVal += (dx / (dist + 1)) * factor
          wVal += Math.exp(-(dist * dist) / (r * r * 0.5)) * 1.5 * (1 - altFactor)
        }

        // 5. 青藏高原阻挡（低层绕流+强迫抬升）
        {
          const cx = 90, cy = 33, rx = 10, ry = 6
          const dx = (lon - cx) / rx, dy = (lat - cy) / ry
          const dist2 = dx * dx + dy * dy
          if (dist2 < 4) {
            const highlandAlt = 5000
            if (alt < highlandAlt) {
              const blockFactor = Math.exp(-dist2) * 0.8
              uVal *= 1 - blockFactor
              vVal += uVal * blockFactor * 0.3 * (lat > cy ? 1 : -1)
              // 高原迎风坡强迫抬升
              wVal += Math.exp(-dist2 * 0.5) * 3.0 * (1 - alt / highlandAlt)
            }
          }
        }

        // 6. 大尺度下沉运动（副热带高压区）
        {
          const cx = 125, cy = 28
          const dist2 = ((lon - cx) ** 2 + (lat - cy) ** 2) / 80
          wVal -= Math.exp(-dist2) * 1.5 * altFactor
        }

        // 7. 噪声扰动
        const n1 = seededRandom(col * 1.1 + lv * 7.3, row * 1.3)
        const n2 = seededRandom(col * 2.7 + lv * 3.1, row * 0.9)
        const n3 = seededRandom(col * 0.7 + lv * 5.9, row * 2.1)
        uVal += (n1 - 0.5) * 3
        vVal += (n2 - 0.5) * 2.5
        wVal += (n3 - 0.5) * 0.8

        // 高空风速整体增强
        uVal += Math.sin(lon * 0.15 + lat * 0.1) * 1.5 * (1 + altFactor)
        vVal += Math.cos(lon * 0.12 - lat * 0.08) * 1.2 * (1 + altFactor * 0.5)

        const idx = row * cols + col
        u[idx] = uVal
        v[idx] = vVal
        w[idx] = wVal

        const speed = Math.sqrt(uVal * uVal + vVal * vVal + wVal * wVal)
        if (speed > maxSpeed) maxSpeed = speed
      }
    }

    uData.push(u)
    vData.push(v)
    wData.push(w)
  }

  return { lonMin, lonMax, latMin, latMax, cols, rows, levels: levelHeights, uData, vData, wData, maxSpeed }
}

/** 三维风场配色方案 */
export const WIND3D_COLOR_SCALES = {
  rainbow: [
    { threshold: 0, color: [0, 0, 255, 200] },
    { threshold: 0.25, color: [0, 200, 255, 210] },
    { threshold: 0.5, color: [0, 255, 100, 220] },
    { threshold: 0.75, color: [255, 255, 0, 230] },
    { threshold: 1, color: [255, 50, 0, 255] },
  ],
  altitude: [
    { threshold: 0, color: [50, 200, 50, 200] },
    { threshold: 0.25, color: [50, 200, 200, 210] },
    { threshold: 0.5, color: [50, 100, 255, 220] },
    { threshold: 0.75, color: [180, 50, 255, 230] },
    { threshold: 1, color: [255, 50, 100, 255] },
  ],
  thermal: [
    { threshold: 0, color: [10, 0, 80, 200] },
    { threshold: 0.25, color: [80, 0, 120, 210] },
    { threshold: 0.5, color: [200, 50, 50, 220] },
    { threshold: 0.75, color: [255, 150, 0, 230] },
    { threshold: 1, color: [255, 255, 100, 255] },
  ],
} as const

export type Wind3DColorScaleName = keyof typeof WIND3D_COLOR_SCALES
