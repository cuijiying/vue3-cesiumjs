/**
 * 无人机轨迹数据类型定义
 */
export interface DronePosition {
  time: number // Unix 时间戳（秒）
  longitude: number // 经度
  latitude: number // 纬度
  altitude: number // 高度（米）
  heading: number // 航向角（度）
  pitch: number // 俯仰角（度）
  roll: number // 翻滚角（度）
  speed: number // 速度（米/秒）
}

/**
 * 生成模拟的无人机轨迹数据
 * 场景：无人机在北京周边进行巡航飞行
 */
export function generateDroneTrajectory(): DronePosition[] {
  const trajectory: DronePosition[] = []
  
  // 起点坐标（北京天安门附近）
  const startLng = 116.397428
  const startLat = 39.909188
  const startAlt = 100 // 起始高度100米
  
  // 时间起点
  const startTime = Date.now() / 1000
  
  // 生成一个矩形巡航路径
  const points = [
    { lng: startLng, lat: startLat, alt: startAlt },
    { lng: startLng + 0.02, lat: startLat, alt: startAlt + 50 }, // 向东
    { lng: startLng + 0.02, lat: startLat + 0.02, alt: startAlt + 100 }, // 向北
    { lng: startLng + 0.01, lat: startLat + 0.03, alt: startAlt + 150 }, // 对角线
    { lng: startLng - 0.01, lat: startLat + 0.03, alt: startAlt + 120 }, // 向西
    { lng: startLng - 0.02, lat: startLat + 0.02, alt: startAlt + 80 }, // 继续向西
    { lng: startLng - 0.02, lat: startLat, alt: startAlt + 50 }, // 向南
    { lng: startLng, lat: startLat, alt: startAlt }, // 返回起点
  ]
  
  // 在每两个点之间插值生成平滑轨迹
  const interpolationSteps = 30 // 每段路径插值30个点
  const timeStep = 2 // 每个点间隔2秒
  
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]
    const end = points[i + 1]
    
    if (!start || !end) continue
    
    for (let j = 0; j <= interpolationSteps; j++) {
      const t = j / interpolationSteps
      
      // 线性插值
      const lng = start.lng + (end.lng - start.lng) * t
      const lat = start.lat + (end.lat - start.lat) * t
      const alt = start.alt + (end.alt - start.alt) * t
      
      // 计算航向角
      const heading = Math.atan2(
        end.lng - start.lng,
        end.lat - start.lat
      ) * (180 / Math.PI)
      
      // 计算俯仰角（根据高度变化）
      const distance = Math.sqrt(
        Math.pow(end.lng - start.lng, 2) + 
        Math.pow(end.lat - start.lat, 2)
      )
      const pitch = Math.atan2(end.alt - start.alt, distance * 111000) * (180 / Math.PI)
      
      // 添加一些随机的翻滚角变化，使飞行更真实
      const roll = Math.sin(t * Math.PI * 4) * 10
      
      // 计算速度
      const speed = 15 + Math.random() * 5 // 15-20米/秒
      
      trajectory.push({
        time: startTime + (i * interpolationSteps + j) * timeStep,
        longitude: lng,
        latitude: lat,
        altitude: alt,
        heading: heading,
        pitch: pitch,
        roll: roll,
        speed: speed
      })
    }
  }
  
  return trajectory
}

/**
 * 生成另一个更复杂的轨迹：螺旋上升
 */
export function generateSpiralTrajectory(): DronePosition[] {
  const trajectory: DronePosition[] = []
  
  const centerLng = 116.407395
  const centerLat = 39.904211
  const baseAlt = 50
  
  const startTime = Date.now() / 1000
  const totalPoints = 200
  const radius = 0.01 // 半径约1公里
  
  for (let i = 0; i < totalPoints; i++) {
    const angle = (i / totalPoints) * Math.PI * 6 // 3圈
    const currentRadius = radius * (1 - i / totalPoints * 0.5) // 半径逐渐缩小
    
    const lng = centerLng + currentRadius * Math.cos(angle)
    const lat = centerLat + currentRadius * Math.sin(angle)
    const alt = baseAlt + (i / totalPoints) * 300 // 上升到350米
    
    const heading = (angle * 180 / Math.PI + 90) % 360
    const pitch = Math.atan2(300 / totalPoints, currentRadius * 111000 / totalPoints) * (180 / Math.PI)
    const roll = 15 * Math.sign(Math.sin(angle)) // 倾斜转弯
    const speed = 12 + Math.random() * 3
    
    trajectory.push({
      time: startTime + i * 1.5,
      longitude: lng,
      latitude: lat,
      altitude: alt,
      heading: heading,
      pitch: pitch,
      roll: roll,
      speed: speed
    })
  }
  
  return trajectory
}

/**
 * 生成地形跟随轨迹
 */
export function generateTerrainFollowTrajectory(): DronePosition[] {
  const trajectory: DronePosition[] = []
  
  const startLng = 116.380
  const startLat = 39.920
  const startTime = Date.now() / 1000
  
  const points = 150
  
  for (let i = 0; i < points; i++) {
    const t = i / points
    
    // 向东北方向飞行
    const lng = startLng + t * 0.04
    const lat = startLat + t * 0.03
    
    // 模拟地形起伏，高度随机波动
    const terrainHeight = 50 + Math.sin(t * Math.PI * 4) * 30 + Math.cos(t * Math.PI * 7) * 20
    const flyHeight = 80 // 离地高度
    const alt = terrainHeight + flyHeight
    
    const heading = 45 // 东北方向
    const pitch = (Math.sin(t * Math.PI * 4) * Math.PI / 6) * (180 / Math.PI)
    const roll = Math.sin(t * Math.PI * 8) * 5
    const speed = 18 + Math.random() * 4
    
    trajectory.push({
      time: startTime + i * 2,
      longitude: lng,
      latitude: lat,
      altitude: alt,
      heading: heading,
      pitch: pitch,
      roll: roll,
      speed: speed
    })
  }
  
  return trajectory
}

// 预设的轨迹数据
export const trajectoryPresets = {
  rectangular: {
    name: '矩形巡航',
    description: '在城市上空进行矩形路径巡航',
    data: generateDroneTrajectory()
  },
  spiral: {
    name: '螺旋上升',
    description: '螺旋上升飞行模式',
    data: generateSpiralTrajectory()
  },
  terrainFollow: {
    name: '地形跟随',
    description: '低空地形跟随飞行',
    data: generateTerrainFollowTrajectory()
  }
}
