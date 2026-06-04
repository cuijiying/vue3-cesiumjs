/**
 * 低空气象 + 数字孪生 + XR + AI飞行决策 场景数据与算法
 *
 * 场景：深圳福田 CBD 低空经济空域
 *  - 数字孪生：城市建筑群（楼宇高度参与避障计算）
 *  - 低空气象：风场 / 降水 / 低云雾 / 湍流 多要素体数据
 *  - 飞行走廊：无人机航线（多航点）
 *  - AI 飞行决策：综合气象与障碍物，逐段评估风险并给出 GO / CAUTION / NO-GO 建议
 */

/** 每度对应的米数（粗略） */
export const M_PER_DEG = 111000

/** 场景中心（深圳福田 CBD） */
export const SCENE_CENTER = { lon: 114.0579, lat: 22.5431 }

/** 数字孪生建筑 */
export interface TwinBuilding {
  id: string
  name: string
  lon: number
  lat: number
  /** 平面尺寸（米） */
  width: number
  depth: number
  /** 建筑高度（米） */
  height: number
}

/** 气象单体类型 */
export type WeatherCellType = 'rain' | 'fog' | 'turbulence'

/** 气象单体（降水 / 低云雾 / 湍流） */
export interface WeatherCell {
  id: string
  type: WeatherCellType
  name: string
  lon: number
  lat: number
  /** 水平影响半径（米） */
  radius: number
  /** 体顶部高度（米） */
  top: number
  /** 体底部高度（米） */
  bottom: number
  /** 基础强度 0~1（最终强度再乘以情景系数） */
  intensity: number
}

/** 飞行航点 */
export interface Waypoint {
  name: string
  lon: number
  lat: number
}

/** 气象情景 */
export type WeatherScenarioKey = 'clear' | 'lightRain' | 'storm' | 'fog'

export interface WeatherScenario {
  key: WeatherScenarioKey
  name: string
  description: string
  /** 风速 m/s */
  windSpeed: number
  /** 风向（度，气象风来向） */
  windDirection: number
  /** 能见度（米） */
  visibility: number
  /** 降水强度系数 0~1 */
  rainFactor: number
  /** 雾强度系数 0~1 */
  fogFactor: number
  /** 湍流强度系数 0~1 */
  turbulenceFactor: number
}

/** 气象情景预设 */
export const WEATHER_SCENARIOS: Record<WeatherScenarioKey, WeatherScenario> = {
  clear: {
    key: 'clear',
    name: '☀️ 晴朗',
    description: '微风、能见度良好，适宜飞行',
    windSpeed: 3,
    windDirection: 90,
    visibility: 15000,
    rainFactor: 0,
    fogFactor: 0,
    turbulenceFactor: 0.15,
  },
  lightRain: {
    key: 'lightRain',
    name: '🌦️ 小雨',
    description: '阵性小雨，局地能见度下降',
    windSpeed: 7,
    windDirection: 120,
    visibility: 6000,
    rainFactor: 0.5,
    fogFactor: 0.2,
    turbulenceFactor: 0.35,
  },
  storm: {
    key: 'storm',
    name: '⛈️ 强对流',
    description: '强风暴雨伴湍流，飞行风险高',
    windSpeed: 16,
    windDirection: 160,
    visibility: 2500,
    rainFactor: 1,
    fogFactor: 0.3,
    turbulenceFactor: 1,
  },
  fog: {
    key: 'fog',
    name: '🌫️ 大雾',
    description: '平流雾，能见度极低',
    windSpeed: 2,
    windDirection: 60,
    visibility: 600,
    rainFactor: 0,
    fogFactor: 1,
    turbulenceFactor: 0.2,
  },
}

/** 数字孪生建筑群（围绕 CBD 中心布置，含地标高楼） */
export const TWIN_BUILDINGS: TwinBuilding[] = [
  { id: 'b1', name: '平安金融中心', lon: 114.0506, lat: 22.5366, width: 80, depth: 80, height: 290 },
  { id: 'b2', name: '京基100', lon: 114.0931, lat: 22.5447, width: 70, depth: 70, height: 240 },
  { id: 'b3', name: '汉国中心', lon: 114.0639, lat: 22.5402, width: 60, depth: 60, height: 200 },
  { id: 'b4', name: '卓越大厦', lon: 114.0631, lat: 22.5468, width: 55, depth: 55, height: 170 },
  { id: 'b5', name: '会展中心', lon: 114.0596, lat: 22.5402, width: 220, depth: 90, height: 60 },
  { id: 'b6', name: '星河COCO', lon: 114.0668, lat: 22.5439, width: 90, depth: 70, height: 130 },
  { id: 'b7', name: '招商银行', lon: 114.0531, lat: 22.5418, width: 60, depth: 60, height: 160 },
  { id: 'b8', name: '中心广场A', lon: 114.0552, lat: 22.5448, width: 50, depth: 50, height: 110 },
  { id: 'b9', name: '中心广场B', lon: 114.0578, lat: 22.5462, width: 50, depth: 50, height: 120 },
  { id: 'b10', name: '福田CBD塔', lon: 114.0604, lat: 22.5435, width: 65, depth: 65, height: 185 },
  { id: 'b11', name: '商务公寓1', lon: 114.0623, lat: 22.5388, width: 45, depth: 45, height: 95 },
  { id: 'b12', name: '商务公寓2', lon: 114.0651, lat: 22.5415, width: 45, depth: 45, height: 100 },
  { id: 'b13', name: '科技大厦', lon: 114.0688, lat: 22.5468, width: 55, depth: 55, height: 150 },
  { id: 'b14', name: '城市综合体', lon: 114.0537, lat: 22.5471, width: 100, depth: 80, height: 90 },
  { id: 'b15', name: '滨河大厦', lon: 114.0709, lat: 22.5421, width: 50, depth: 50, height: 140 },
  { id: 'b16', name: '低空起降坪', lon: 114.0481, lat: 22.5447, width: 60, depth: 60, height: 25 },
]

/** 气象单体（位置固定，强度随情景缩放） */
export const WEATHER_CELLS: WeatherCell[] = [
  {
    id: 'rain1',
    type: 'rain',
    name: '降水单体 R-1',
    lon: 114.0612,
    lat: 22.5448,
    radius: 600,
    top: 800,
    bottom: 0,
    intensity: 0.9,
  },
  {
    id: 'rain2',
    type: 'rain',
    name: '降水单体 R-2',
    lon: 114.0689,
    lat: 22.5432,
    radius: 480,
    top: 700,
    bottom: 0,
    intensity: 0.7,
  },
  {
    id: 'fog1',
    type: 'fog',
    name: '低云雾区 F-1',
    lon: 114.0735,
    lat: 22.5443,
    radius: 700,
    top: 220,
    bottom: 0,
    intensity: 0.85,
  },
  {
    id: 'turb1',
    type: 'turbulence',
    name: '湍流区 T-1',
    lon: 114.0512,
    lat: 22.5372,
    radius: 420,
    top: 360,
    bottom: 60,
    intensity: 0.9,
  },
  {
    id: 'turb2',
    type: 'turbulence',
    name: '湍流区 T-2',
    lon: 114.0636,
    lat: 22.5404,
    radius: 380,
    top: 300,
    bottom: 40,
    intensity: 0.7,
  },
]

/** 默认飞行走廊（自西向东穿越 CBD） */
export const FLIGHT_WAYPOINTS: Waypoint[] = [
  { name: '起飞点·起降坪', lon: 114.0481, lat: 22.5447 },
  { name: 'WP1', lon: 114.0532, lat: 22.5432 },
  { name: 'WP2', lon: 114.0592, lat: 22.5438 },
  { name: 'WP3', lon: 114.0648, lat: 22.5444 },
  { name: 'WP4', lon: 114.0702, lat: 22.5436 },
  { name: '降落点·物流站', lon: 114.0758, lat: 22.5448 },
]

/* ------------------------------------------------------------------ */
/* 几何工具                                                            */
/* ------------------------------------------------------------------ */

/** 两经纬度点间水平距离（米） */
export function haversineMeters(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** 点到线段的最近水平距离（米，等距投影近似） */
export function pointToSegmentMeters(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const cosLat = Math.cos((py * Math.PI) / 180)
  // 转换到局部米平面
  const Ax = (ax - px) * M_PER_DEG * cosLat
  const Ay = (ay - py) * M_PER_DEG
  const Bx = (bx - px) * M_PER_DEG * cosLat
  const By = (by - py) * M_PER_DEG
  const dx = Bx - Ax
  const dy = By - Ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(Ax, Ay)
  let t = -(Ax * dx + Ay * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = Ax + t * dx
  const cy = Ay + t * dy
  return Math.hypot(cx, cy)
}

/** 沿航点序列按归一化进度插值出位置（含累计里程） */
export function interpolateAlongRoute(
  waypoints: Waypoint[],
  progress: number,
): { lon: number; lat: number } {
  const first = waypoints[0]!
  if (waypoints.length === 0) return { lon: 0, lat: 0 }
  if (waypoints.length === 1) return { lon: first.lon, lat: first.lat }

  const segLens: number[] = []
  let total = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[i]!
    const p1 = waypoints[i + 1]!
    const d = haversineMeters(p0.lon, p0.lat, p1.lon, p1.lat)
    segLens.push(d)
    total += d
  }
  const target = Math.max(0, Math.min(1, progress)) * total
  let acc = 0
  for (let i = 0; i < segLens.length; i++) {
    const segLen = segLens[i]!
    const p0 = waypoints[i]!
    const p1 = waypoints[i + 1]!
    if (acc + segLen >= target) {
      const t = segLen === 0 ? 0 : (target - acc) / segLen
      return {
        lon: p0.lon + (p1.lon - p0.lon) * t,
        lat: p0.lat + (p1.lat - p0.lat) * t,
      }
    }
    acc += segLen
  }
  const last = waypoints[waypoints.length - 1]!
  return { lon: last.lon, lat: last.lat }
}

/* ------------------------------------------------------------------ */
/* AI 飞行决策评估                                                     */
/* ------------------------------------------------------------------ */

export type RiskLevel = 'safe' | 'caution' | 'danger'

/** 单段航线风险 */
export interface SegmentRisk {
  index: number
  fromName: string
  toName: string
  /** 航段中点 */
  midLon: number
  midLat: number
  /** 0~100 */
  risk: number
  level: RiskLevel
  /** 主要风险因子说明 */
  factors: string[]
}

/** AI 决策结果 */
export interface AIDecision {
  overall: 'GO' | 'CAUTION' | 'NO-GO'
  overallRisk: number
  summary: string
  segments: SegmentRisk[]
  recommendations: string[]
  /** 建议飞行高度（米） */
  suggestedAltitude: number
}

function levelOf(risk: number): RiskLevel {
  if (risk >= 70) return 'danger'
  if (risk >= 40) return 'caution'
  return 'safe'
}

/**
 * 综合评估飞行计划
 * @param scenario 气象情景
 * @param altitude 走廊飞行高度（米）
 * @param waypoints 航点
 */
export function evaluateFlightPlan(
  scenario: WeatherScenario,
  altitude: number,
  waypoints: Waypoint[] = FLIGHT_WAYPOINTS,
  buildings: TwinBuilding[] = TWIN_BUILDINGS,
  cells: WeatherCell[] = WEATHER_CELLS,
): AIDecision {
  const segments: SegmentRisk[] = []
  const CLEARANCE = 30 // 越障安全余量（米）

  // 全局风险：风速、能见度
  // 风速：6m/s 起算，>14m/s 接近上限
  const windRisk = Math.min(100, Math.max(0, (scenario.windSpeed - 4) * 7))
  // 能见度：低空目视要求，<3000m 风险快速上升
  const visRisk =
    scenario.visibility >= 8000
      ? 0
      : Math.min(100, ((8000 - scenario.visibility) / 8000) * 100)

  let maxBuildingHeight = 0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!
    const b = waypoints[i + 1]!
    const midLon = (a.lon + b.lon) / 2
    const midLat = (a.lat + b.lat) / 2
    const factors: string[] = []

    let rainRisk = 0
    let fogRisk = 0
    let turbRisk = 0
    let obstacleRisk = 0

    // 气象单体：判断航段是否穿越影响范围
    for (const cell of cells) {
      const dist = pointToSegmentMeters(cell.lon, cell.lat, a.lon, a.lat, b.lon, b.lat)
      if (dist > cell.radius) continue
      // 是否在垂直影响范围内
      const inVertical = altitude >= cell.bottom - 20 && altitude <= cell.top + 20
      if (!inVertical) continue
      const proximity = 1 - dist / cell.radius // 0~1
      if (cell.type === 'rain') {
        const r = proximity * cell.intensity * scenario.rainFactor * 100
        if (r > rainRisk) rainRisk = r
      } else if (cell.type === 'fog') {
        const r = proximity * cell.intensity * scenario.fogFactor * 100
        if (r > fogRisk) fogRisk = r
      } else if (cell.type === 'turbulence') {
        const r = proximity * cell.intensity * scenario.turbulenceFactor * 100
        if (r > turbRisk) turbRisk = r
      }
    }

    // 障碍物（建筑）：航段附近楼宇是否高于飞行高度 - 余量
    for (const bld of buildings) {
      const dist = pointToSegmentMeters(bld.lon, bld.lat, a.lon, a.lat, b.lon, b.lat)
      const influence = Math.max(bld.width, bld.depth) / 2 + 80 // 建筑半宽 + 缓冲
      if (dist > influence) continue
      maxBuildingHeight = Math.max(maxBuildingHeight, bld.height)
      const required = bld.height + CLEARANCE
      if (altitude < required) {
        const deficit = required - altitude
        const r = Math.min(100, (deficit / required) * 140)
        if (r > obstacleRisk) {
          obstacleRisk = r
          factors.push(`近「${bld.name}」(${bld.height}m) 净空不足`)
        }
      }
    }

    if (rainRisk > 25) factors.push('穿越降水单体')
    if (fogRisk > 25) factors.push('低云雾区能见度差')
    if (turbRisk > 25) factors.push('湍流扰动明显')

    // 航段综合风险：取主导因子并叠加全局项
    const localMax = Math.max(rainRisk, fogRisk, turbRisk, obstacleRisk)
    const globalMax = Math.max(windRisk, visRisk)
    const risk = Math.min(
      100,
      Math.round(localMax * 0.7 + globalMax * 0.45 + Math.min(rainRisk, fogRisk, turbRisk) * 0.1),
    )

    segments.push({
      index: i,
      fromName: a.name,
      toName: b.name,
      midLon,
      midLat,
      risk,
      level: levelOf(risk),
      factors,
    })
  }

  const overallRisk = segments.length
    ? Math.round(
        segments.reduce((s, seg) => s + seg.risk, 0) / segments.length * 0.5 +
          Math.max(...segments.map((s) => s.risk)) * 0.5,
      )
    : 0

  let overall: AIDecision['overall'] = 'GO'
  if (overallRisk >= 70 || segments.some((s) => s.level === 'danger')) overall = 'NO-GO'
  else if (overallRisk >= 40 || segments.some((s) => s.level === 'caution')) overall = 'CAUTION'

  // 建议飞行高度：高于最高障碍 + 余量，并考虑雾顶
  const fogTop = Math.max(0, ...cells.filter((c) => c.type === 'fog').map((c) => c.top))
  const suggestedAltitude = Math.max(
    altitude,
    maxBuildingHeight + CLEARANCE,
    scenario.fogFactor > 0.6 ? fogTop + 20 : 0,
  )

  // 决策建议
  const recommendations: string[] = []
  if (overall === 'GO') {
    recommendations.push('气象与净空条件良好，可按计划执行飞行任务。')
  }
  if (maxBuildingHeight + CLEARANCE > altitude) {
    recommendations.push(
      `提升巡航高度至 ${Math.ceil(suggestedAltitude)}m 以上以保证楼宇净空。`,
    )
  }
  if (windRisk >= 50) {
    recommendations.push(
      `当前风速 ${scenario.windSpeed}m/s 偏大，建议降速飞行并加强姿态控制。`,
    )
  }
  if (visRisk >= 50) {
    recommendations.push(
      `能见度 ${scenario.visibility}m 低于目视要求，建议改用 BVLOS 仪表航路或推迟起飞。`,
    )
  }
  if (segments.some((s) => s.factors.includes('穿越降水单体'))) {
    recommendations.push('航线穿越降水单体，建议绕飞或择机避开强回波区。')
  }
  if (segments.some((s) => s.factors.includes('湍流扰动明显'))) {
    recommendations.push('存在湍流扰动航段，建议调整高度层避开建筑尾流区。')
  }
  if (overall === 'NO-GO') {
    recommendations.push('综合风险过高，AI 建议暂停本次飞行，等待气象条件转好。')
  }

  let summary = ''
  if (overall === 'GO') summary = 'AI 评估：航线安全，建议执行。'
  else if (overall === 'CAUTION') summary = 'AI 评估：存在中等风险，需谨慎并采取缓解措施。'
  else summary = 'AI 评估：风险过高，不建议飞行。'

  return {
    overall,
    overallRisk,
    summary,
    segments,
    recommendations,
    suggestedAltitude: Math.ceil(suggestedAltitude),
  }
}

/** 风险等级对应颜色（CSS） */
export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'safe':
      return '#00e676'
    case 'caution':
      return '#ffb300'
    case 'danger':
      return '#ff3d57'
  }
}
