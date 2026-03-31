/**
 * 无人机巡查路线数据类型定义
 */
export interface PatrolWaypoint {
  id: number
  name: string // 巡查点名称
  longitude: number
  latitude: number
  altitude: number // 飞行高度（米）
  hoverDuration: number // 悬停巡查时间（秒）
  inspectType: 'visual' | 'thermal' | 'photo' // 巡查类型
  description: string // 巡查任务描述
}

export interface PatrolStatus {
  waypointId: number
  status: 'pending' | 'in-progress' | 'completed' | 'flagged'
  startTime?: number
  endTime?: number
  note?: string
}

/**
 * 巡查区域定义
 */
export interface PatrolArea {
  name: string
  description: string
  waypoints: PatrolWaypoint[]
  boundaryColor: string // 区域边界颜色
}

/**
 * 场景一：工业园区安全巡查
 * 位于北京亦庄经济开发区附近
 */
export function generateIndustryPatrol(): PatrolArea {
  return {
    name: '工业园区安全巡查',
    description: '对工业园区厂房、仓库、围栏进行安全检查',
    boundaryColor: '#FF6B35',
    waypoints: [
      {
        id: 1,
        name: '园区主入口',
        longitude: 116.510,
        latitude: 39.790,
        altitude: 80,
        hoverDuration: 5,
        inspectType: 'visual',
        description: '检查大门安保设施与车辆出入情况',
      },
      {
        id: 2,
        name: 'A栋厂房屋顶',
        longitude: 116.512,
        latitude: 39.792,
        altitude: 120,
        hoverDuration: 8,
        inspectType: 'thermal',
        description: '红外热成像检测厂房屋顶温度异常',
      },
      {
        id: 3,
        name: '化学品仓库',
        longitude: 116.514,
        latitude: 39.793,
        altitude: 60,
        hoverDuration: 10,
        inspectType: 'photo',
        description: '拍照记录仓库外部状态及危险品标识',
      },
      {
        id: 4,
        name: '变电站',
        longitude: 116.515,
        latitude: 39.791,
        altitude: 100,
        hoverDuration: 8,
        inspectType: 'thermal',
        description: '红外检测变压器及配电设备温度',
      },
      {
        id: 5,
        name: 'B栋厂房',
        longitude: 116.513,
        latitude: 39.789,
        altitude: 120,
        hoverDuration: 6,
        inspectType: 'visual',
        description: '目视检查厂房外墙及门窗状态',
      },
      {
        id: 6,
        name: '北侧围栏',
        longitude: 116.511,
        latitude: 39.794,
        altitude: 50,
        hoverDuration: 12,
        inspectType: 'photo',
        description: '巡查围栏完整性，拍照记录破损点',
      },
      {
        id: 7,
        name: '停车场',
        longitude: 116.509,
        latitude: 39.792,
        altitude: 80,
        hoverDuration: 5,
        inspectType: 'visual',
        description: '检查停车场车辆停放秩序及消防通道畅通',
      },
      {
        id: 8,
        name: '园区主入口（返航）',
        longitude: 116.510,
        latitude: 39.790,
        altitude: 80,
        hoverDuration: 3,
        inspectType: 'visual',
        description: '返回起飞点降落',
      },
    ],
  }
}

/**
 * 场景二：河道巡查
 * 沿河道飞行检查河堤、排污口等
 */
export function generateRiverPatrol(): PatrolArea {
  return {
    name: '河道环境巡查',
    description: '沿河道飞行巡查水质、排污口、河堤状态',
    boundaryColor: '#2196F3',
    waypoints: [
      {
        id: 1,
        name: '起飞点-河道桥头',
        longitude: 116.420,
        latitude: 39.930,
        altitude: 60,
        hoverDuration: 3,
        inspectType: 'visual',
        description: '从桥头起飞，检查桥下河道通畅情况',
      },
      {
        id: 2,
        name: '排污口A',
        longitude: 116.423,
        latitude: 39.932,
        altitude: 30,
        hoverDuration: 10,
        inspectType: 'photo',
        description: '低空拍照检查排污口排放状态',
      },
      {
        id: 3,
        name: '河堤巡检段1',
        longitude: 116.427,
        latitude: 39.934,
        altitude: 50,
        hoverDuration: 8,
        inspectType: 'visual',
        description: '检查河堤是否有塌陷或裂痕',
      },
      {
        id: 4,
        name: '水质监测点',
        longitude: 116.430,
        latitude: 39.936,
        altitude: 20,
        hoverDuration: 15,
        inspectType: 'photo',
        description: '低空悬停拍照，记录水面颜色和漂浮物',
      },
      {
        id: 5,
        name: '排污口B',
        longitude: 116.434,
        latitude: 39.938,
        altitude: 30,
        hoverDuration: 10,
        inspectType: 'photo',
        description: '拍照记录第二个排污口状态',
      },
      {
        id: 6,
        name: '河堤巡检段2',
        longitude: 116.437,
        latitude: 39.940,
        altitude: 50,
        hoverDuration: 8,
        inspectType: 'visual',
        description: '检查河堤护坡完整性',
      },
      {
        id: 7,
        name: '终点-下游桥头',
        longitude: 116.440,
        latitude: 39.942,
        altitude: 60,
        hoverDuration: 3,
        inspectType: 'visual',
        description: '到达终点桥头，准备降落',
      },
    ],
  }
}

/**
 * 场景三：光伏电站巡检
 */
export function generateSolarPatrol(): PatrolArea {
  return {
    name: '光伏电站巡检',
    description: '对光伏面板阵列进行红外热成像及目视巡检',
    boundaryColor: '#FFC107',
    waypoints: [
      {
        id: 1,
        name: '起飞点-控制室',
        longitude: 116.460,
        latitude: 39.850,
        altitude: 50,
        hoverDuration: 3,
        inspectType: 'visual',
        description: '从控制室旁起飞',
      },
      {
        id: 2,
        name: 'A区面板阵列',
        longitude: 116.462,
        latitude: 39.852,
        altitude: 40,
        hoverDuration: 12,
        inspectType: 'thermal',
        description: '红外扫描A区面板，检测热斑异常',
      },
      {
        id: 3,
        name: 'B区面板阵列',
        longitude: 116.465,
        latitude: 39.853,
        altitude: 40,
        hoverDuration: 12,
        inspectType: 'thermal',
        description: '红外扫描B区面板，检测热斑异常',
      },
      {
        id: 4,
        name: '逆变器区域',
        longitude: 116.467,
        latitude: 39.851,
        altitude: 60,
        hoverDuration: 8,
        inspectType: 'photo',
        description: '拍照检查逆变器设备外观及指示灯状态',
      },
      {
        id: 5,
        name: 'C区面板阵列',
        longitude: 116.464,
        latitude: 39.849,
        altitude: 40,
        hoverDuration: 12,
        inspectType: 'thermal',
        description: '红外扫描C区面板',
      },
      {
        id: 6,
        name: '围栏巡查',
        longitude: 116.461,
        latitude: 39.848,
        altitude: 30,
        hoverDuration: 8,
        inspectType: 'visual',
        description: '低空巡查电站围栏完整性',
      },
      {
        id: 7,
        name: '返航-控制室',
        longitude: 116.460,
        latitude: 39.850,
        altitude: 50,
        hoverDuration: 3,
        inspectType: 'visual',
        description: '返回控制室降落',
      },
    ],
  }
}

/**
 * 巡查预设数据
 */
export const patrolPresets = {
  industry: generateIndustryPatrol(),
  river: generateRiverPatrol(),
  solar: generateSolarPatrol(),
}

export type PatrolPresetKey = keyof typeof patrolPresets
