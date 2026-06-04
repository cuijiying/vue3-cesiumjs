/**
 * AI 智能目标检测模拟数据
 * 模拟卫星/无人机影像 AI 分析结果
 */

/** 目标类别 */
export type TargetCategory =
  | 'illegal_building'   // 违法建筑
  | 'water_pollution'    // 水体污染
  | 'vegetation_damage'  // 植被破坏
  | 'road_damage'        // 道路损坏
  | 'facility_anomaly'   // 设施异常
  | 'land_change'        // 土地变化

/** 单个检测目标 */
export interface DetectionTarget {
  id: string
  /** 目标类别 */
  category: TargetCategory
  /** 置信度 0-1 */
  confidence: number
  /** 目标中心经度 */
  lon: number
  /** 目标中心纬度 */
  lat: number
  /** 检测框半径（米） */
  radius: number
  /** 严重等级: 1-低 2-中 3-高 */
  severity: 1 | 2 | 3
  /** 描述 */
  description: string
  /** 检测时间 */
  detectedAt: string
}

/** AI 模型配置 */
export interface AIModelConfig {
  name: string
  description: string
  categories: TargetCategory[]
  /** 模拟推理耗时(ms) */
  inferenceTime: number
}

/** 检测结果统计 */
export interface DetectionStats {
  total: number
  byCategory: Record<TargetCategory, number>
  bySeverity: Record<number, number>
  avgConfidence: number
}

/** 类别显示信息 */
export const CATEGORY_INFO: Record<TargetCategory, { label: string; color: string; icon: string }> = {
  illegal_building: { label: '违法建筑', color: '#FF4444', icon: '🏗️' },
  water_pollution: { label: '水体污染', color: '#8B44FF', icon: '💧' },
  vegetation_damage: { label: '植被破坏', color: '#FF8C00', icon: '🌿' },
  road_damage: { label: '道路损坏', color: '#FFD700', icon: '🛣️' },
  facility_anomaly: { label: '设施异常', color: '#00CED1', icon: '⚙️' },
  land_change: { label: '土地变化', color: '#32CD32', icon: '🗺️' },
}

/** 严重等级信息 */
export const SEVERITY_INFO: Record<number, { label: string; color: string }> = {
  1: { label: '低', color: '#4CAF50' },
  2: { label: '中', color: '#FF9800' },
  3: { label: '高', color: '#F44336' },
}

/** 预设 AI 模型 */
export const AI_MODELS: AIModelConfig[] = [
  {
    name: 'GeoDetect-v3',
    description: '通用地物检测模型，支持6类目标识别',
    categories: ['illegal_building', 'water_pollution', 'vegetation_damage', 'road_damage', 'facility_anomaly', 'land_change'],
    inferenceTime: 3000,
  },
  {
    name: 'BuildingWatch-v2',
    description: '建筑物专项检测模型，侧重违建和设施分析',
    categories: ['illegal_building', 'facility_anomaly', 'land_change'],
    inferenceTime: 2000,
  },
  {
    name: 'EcoGuard-v1',
    description: '生态环境监测模型，侧重水体和植被',
    categories: ['water_pollution', 'vegetation_damage', 'land_change'],
    inferenceTime: 2500,
  },
]

/** 预设分析区域 */
export interface AnalysisRegion {
  name: string
  description: string
  center: { lon: number; lat: number }
  /** 区域半径(米) */
  radius: number
  /** 相机高度(米) */
  cameraHeight: number
}

export const ANALYSIS_REGIONS: AnalysisRegion[] = [
  {
    name: '北京城区',
    description: '城市建筑密集区域，重点检测违建和设施异常',
    center: { lon: 116.404, lat: 39.915 },
    radius: 5000,
    cameraHeight: 15000,
  },
  {
    name: '太湖流域',
    description: '水域生态监测区域，重点检测水体污染和植被变化',
    center: { lon: 120.215, lat: 31.165 },
    radius: 8000,
    cameraHeight: 25000,
  },
  {
    name: '深圳湾区',
    description: '城市扩展区域，重点检测土地变化和道路损坏',
    center: { lon: 113.945, lat: 22.535 },
    radius: 6000,
    cameraHeight: 18000,
  },
]

/**
 * 伪随机数生成器（保证同区域同模型结果一致）
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * 模拟 AI 检测推理，生成检测结果
 */
export function simulateAIDetection(
  region: AnalysisRegion,
  model: AIModelConfig,
): DetectionTarget[] {
  // 用区域名+模型名生成种子，保证结果稳定
  const seedStr = `${region.name}-${model.name}`
  let seed = 0
  for (let i = 0; i < seedStr.length; i++) {
    seed = ((seed << 5) - seed + seedStr.charCodeAt(i)) | 0
  }
  const rand = seededRandom(Math.abs(seed) + 1)

  const targets: DetectionTarget[] = []
  const categories = model.categories
  // 每个类别生成 3~8 个目标
  const targetCount = Math.floor(rand() * 15) + 12

  for (let i = 0; i < targetCount; i++) {
    const category = categories[Math.floor(rand() * categories.length)]!
    const angle = rand() * Math.PI * 2
    const dist = rand() * region.radius * 0.9
    // 将距离从米转为大致经纬度偏移
    const dLon = (dist * Math.cos(angle)) / (111320 * Math.cos((region.center.lat * Math.PI) / 180))
    const dLat = (dist * Math.sin(angle)) / 110540

    const confidence = 0.45 + rand() * 0.55 // 0.45 ~ 1.0
    const severity = confidence > 0.85 ? 3 : confidence > 0.65 ? 2 : 1

    const descriptions: Record<TargetCategory, string[]> = {
      illegal_building: ['疑似新增违法建筑', '未审批临时搭建', '超面积建设区域', '占用绿地建筑'],
      water_pollution: ['水体颜色异常', '疑似排污口活跃', '水面漂浮物聚集', '水质浑浊区域'],
      vegetation_damage: ['植被覆盖度下降', '疑似砍伐区域', '植被枯萎异常', '绿地面积减少'],
      road_damage: ['路面裂缝检测', '路基塌陷风险', '道路积水区域', '路面破损区域'],
      facility_anomaly: ['设备温度异常', '基础设施老化', '防护设施缺失', '安全隐患区域'],
      land_change: ['新增建设用地', '耕地面积变化', '土地性质变更', '地表覆盖变化'],
    }

    const descList = descriptions[category]
    const description = descList[Math.floor(rand() * descList.length)]!

    targets.push({
      id: `det-${region.name}-${i}`,
      category,
      confidence: Math.round(confidence * 100) / 100,
      lon: region.center.lon + dLon,
      lat: region.center.lat + dLat,
      radius: 30 + Math.floor(rand() * 120),
      severity: severity as 1 | 2 | 3,
      description,
      detectedAt: new Date(Date.now() - Math.floor(rand() * 86400000 * 7)).toISOString(),
    })
  }

  // 按置信度降序排列
  targets.sort((a, b) => b.confidence - a.confidence)
  return targets
}

/**
 * 计算检测结果统计
 */
export function calcDetectionStats(targets: DetectionTarget[]): DetectionStats {
  const byCategory = {} as Record<TargetCategory, number>
  const bySeverity: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  let totalConf = 0

  for (const t of targets) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1
    bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1
    totalConf += t.confidence
  }

  return {
    total: targets.length,
    byCategory,
    bySeverity,
    avgConfidence: targets.length > 0 ? totalConf / targets.length : 0,
  }
}
