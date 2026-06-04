/**
 * 雷达三维扫描数据与工具函数
 */

const M_PER_DEG = 111000

/** 雷达扫描参数 */
export interface RadarScanParams {
  /** 雷达中心经度 */
  lon: number
  /** 雷达中心纬度 */
  lat: number
  /** 雷达高度（米） */
  height: number
  /** 扫描半径（米） */
  radius: number
  /** 旋转速度（度/秒） */
  speed: number
  /** 波束宽度（度） */
  beamWidth: number
  /** 拖尾长度（度） */
  trailLength: number
  /** 距离环数量 */
  rings: number
}

/** 雷达目标 */
export interface RadarTarget {
  id: string
  lon: number
  lat: number
  altitude: number
  label: string
  type: 'aircraft' | 'ship' | 'vehicle' | 'unknown'
}

/** 雷达预设场景 */
export interface RadarPreset {
  name: string
  description: string
  params: RadarScanParams
  targets: RadarTarget[]
  cameraDestination: { lon: number; lat: number; height: number }
}

/** 预设场景列表 */
export const RADAR_PRESETS: RadarPreset[] = [
  {
    name: '军事雷达',
    description: '远程搜索雷达，大范围扫描',
    params: {
      lon: 116.397,
      lat: 39.908,
      height: 150,
      radius: 3000,
      speed: 60,
      beamWidth: 20,
      trailLength: 90,
      rings: 5,
    },
    targets: [
      { id: 't1', lon: 116.407, lat: 39.918, altitude: 500, label: '飞行器-001', type: 'aircraft' },
      { id: 't2', lon: 116.385, lat: 39.922, altitude: 200, label: '飞行器-002', type: 'aircraft' },
      { id: 't3', lon: 116.412, lat: 39.902, altitude: 0, label: '车辆-001', type: 'vehicle' },
      { id: 't4', lon: 116.382, lat: 39.895, altitude: 0, label: '未知目标', type: 'unknown' },
      { id: 't5', lon: 116.402, lat: 39.928, altitude: 300, label: '飞行器-003', type: 'aircraft' },
    ],
    cameraDestination: { lon: 116.397, lat: 39.888, height: 8000 },
  },
  {
    name: '气象雷达',
    description: '气象探测雷达，慢速旋转',
    params: {
      lon: 121.474,
      lat: 31.230,
      height: 100,
      radius: 5000,
      speed: 30,
      beamWidth: 15,
      trailLength: 60,
      rings: 6,
    },
    targets: [
      { id: 't1', lon: 121.495, lat: 31.248, altitude: 1000, label: '云团-A', type: 'unknown' },
      { id: 't2', lon: 121.455, lat: 31.252, altitude: 800, label: '云团-B', type: 'unknown' },
      { id: 't3', lon: 121.490, lat: 31.215, altitude: 600, label: '云团-C', type: 'unknown' },
    ],
    cameraDestination: { lon: 121.474, lat: 31.205, height: 12000 },
  },
  {
    name: '近程防御',
    description: '近程快速扫描雷达',
    params: {
      lon: 113.264,
      lat: 23.129,
      height: 80,
      radius: 1000,
      speed: 180,
      beamWidth: 30,
      trailLength: 120,
      rings: 3,
    },
    targets: [
      { id: 't1', lon: 113.272, lat: 23.136, altitude: 100, label: '目标-A', type: 'aircraft' },
      { id: 't2', lon: 113.256, lat: 23.134, altitude: 50, label: '目标-B', type: 'vehicle' },
      { id: 't3', lon: 113.270, lat: 23.122, altitude: 0, label: '目标-C', type: 'ship' },
      { id: 't4', lon: 113.258, lat: 23.124, altitude: 80, label: '目标-D', type: 'aircraft' },
    ],
    cameraDestination: { lon: 113.264, lat: 23.119, height: 3000 },
  },
]

/** 计算扇形多边形顶点（地面投影） */
export function computeSectorPositions(
  centerLon: number,
  centerLat: number,
  radiusMeters: number,
  headingDeg: number,
  angularWidthDeg: number,
  steps: number = 32,
): [number, number][] {
  const positions: [number, number][] = [[centerLon, centerLat]]
  const startAngle = ((headingDeg - angularWidthDeg / 2) * Math.PI) / 180
  const endAngle = ((headingDeg + angularWidthDeg / 2) * Math.PI) / 180
  const cosLat = Math.cos((centerLat * Math.PI) / 180)

  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + ((endAngle - startAngle) * i) / steps
    const lon = centerLon + (Math.sin(angle) * radiusMeters) / (M_PER_DEG * cosLat)
    const lat = centerLat + (Math.cos(angle) * radiusMeters) / M_PER_DEG
    positions.push([lon, lat])
  }
  return positions
}

/** 计算圆形环线顶点 */
export function computeRingPositions(
  centerLon: number,
  centerLat: number,
  radiusMeters: number,
  steps: number = 64,
): [number, number][] {
  const positions: [number, number][] = []
  const cosLat = Math.cos((centerLat * Math.PI) / 180)

  for (let i = 0; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps
    const lon = centerLon + (Math.sin(angle) * radiusMeters) / (M_PER_DEG * cosLat)
    const lat = centerLat + (Math.cos(angle) * radiusMeters) / M_PER_DEG
    positions.push([lon, lat])
  }
  return positions
}

/** 判断目标是否在雷达波束范围内 */
export function isTargetInBeam(
  targetLon: number,
  targetLat: number,
  centerLon: number,
  centerLat: number,
  currentHeading: number,
  halfAngle: number,
): boolean {
  const dLon = targetLon - centerLon
  const dLat = targetLat - centerLat
  const azimuth = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360
  const diff = Math.abs(((azimuth - currentHeading + 540) % 360) - 180)
  return diff <= halfAngle
}
