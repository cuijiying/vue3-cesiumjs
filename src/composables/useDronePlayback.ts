import { ref, computed } from 'vue'
import * as Cesium from 'cesium'
import type { DronePosition } from '@/data/droneTrajectory'

export interface DronePlaybackOptions {
  viewer: Cesium.Viewer
  trajectory: DronePosition[]
  speedMultiplier?: number // 播放速度倍数
}

/**
 * 无人机轨迹回放 Composable
 */
export function useDronePlayback(options: DronePlaybackOptions) {
  const { viewer, trajectory } = options
  
  // 状态管理
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const currentIndex = ref(0)
  const speedMultiplier = ref(options.speedMultiplier || 1)
  const isFollowing = ref(false) // 相机是否跟随无人机
  
  // 浮点索引，用于平滑动画（支持任意速度倍率）
  let fractionalIndex = 0
  
  // 当前插值位置（可变对象，避免每帧创建新对象）
  const interpolatedPos = {
    longitude: 0, latitude: 0, altitude: 0,
    heading: 0, pitch: 0, roll: 0, speed: 0
  }
  
  // 计算属性
  const currentPosition = computed(() => trajectory[currentIndex.value])
  const progress = computed(() => {
    if (trajectory.length <= 1) return 0
    return (currentIndex.value / (trajectory.length - 1)) * 100
  })
  const totalDuration = computed(() => {
    if (trajectory.length < 2) return 0
    const lastPos = trajectory[trajectory.length - 1]
    const firstPos = trajectory[0]
    if (!lastPos || !firstPos) return 0
    return lastPos.time - firstPos.time
  })
  const currentTime = computed(() => {
    if (trajectory.length === 0 || !currentPosition.value) return 0
    const firstPos = trajectory[0]
    if (!firstPos) return 0
    return currentPosition.value.time - firstPos.time
  })
  
  // Cesium 实体
  let droneEntity: Cesium.Entity | null = null
  let pathEntity: Cesium.Entity | null = null
  let animationFrameId: number | null = null
  let lastUpdateTime: number | null = null
  
  // 路径位置缓存（避免每帧重建数组）
  let cachedPathPositions: Cesium.Cartesian3[] = []
  let cachedPathIndex = -1
  
  /**
   * 插值角度（正确处理 0/360 度边界）
   */
  const lerpAngle = (a: number, b: number, t: number): number => {
    let diff = b - a
    while (diff > 180) diff -= 360
    while (diff < -180) diff += 360
    return a + diff * t
  }
  
  /**
   * 根据浮点索引更新插值位置
   */
  const updateInterpolatedPosition = () => {
    const idx = Math.floor(fractionalIndex)
    const frac = fractionalIndex - idx
    const pos1 = trajectory[idx]
    const pos2 = trajectory[Math.min(idx + 1, trajectory.length - 1)]
    
    if (!pos1) return
    
    if (!pos2 || idx >= trajectory.length - 1) {
      interpolatedPos.longitude = pos1.longitude
      interpolatedPos.latitude = pos1.latitude
      interpolatedPos.altitude = pos1.altitude
      interpolatedPos.heading = pos1.heading
      interpolatedPos.pitch = pos1.pitch
      interpolatedPos.roll = pos1.roll
      interpolatedPos.speed = pos1.speed
      return
    }
    
    interpolatedPos.longitude = pos1.longitude + (pos2.longitude - pos1.longitude) * frac
    interpolatedPos.latitude = pos1.latitude + (pos2.latitude - pos1.latitude) * frac
    interpolatedPos.altitude = pos1.altitude + (pos2.altitude - pos1.altitude) * frac
    interpolatedPos.heading = lerpAngle(pos1.heading, pos2.heading, frac)
    interpolatedPos.pitch = pos1.pitch + (pos2.pitch - pos1.pitch) * frac
    interpolatedPos.roll = pos1.roll + (pos2.roll - pos1.roll) * frac
    interpolatedPos.speed = pos1.speed + (pos2.speed - pos1.speed) * frac
  }
  
  /**
   * 创建无人机实体（使用 CallbackProperty 避免每帧创建新 Property 对象）
   */
  const createDroneEntity = () => {
    if (!currentPosition.value) return
    
    // 初始化插值位置
    Object.assign(interpolatedPos, currentPosition.value)
    
    droneEntity = viewer.entities.add({
      // 使用 CallbackProperty 实时读取插值位置，无需每帧创建新 ConstantPositionProperty
      position: new Cesium.CallbackProperty(() => {
        return Cesium.Cartesian3.fromDegrees(
          interpolatedPos.longitude,
          interpolatedPos.latitude,
          interpolatedPos.altitude
        )
      }, false) as unknown as Cesium.PositionProperty,
      orientation: new Cesium.CallbackProperty(() => {
        const heading = Cesium.Math.toRadians(interpolatedPos.heading)
        const pitch = Cesium.Math.toRadians(interpolatedPos.pitch)
        const roll = Cesium.Math.toRadians(interpolatedPos.roll)
        
        return Cesium.Transforms.headingPitchRollQuaternion(
          Cesium.Cartesian3.fromDegrees(
            interpolatedPos.longitude,
            interpolatedPos.latitude,
            interpolatedPos.altitude
          ),
          new Cesium.HeadingPitchRoll(heading, pitch, roll)
        )
      }, false),
      // 使用正方体表示无人机
      box: {
        dimensions: new Cesium.Cartesian3(30, 30, 15),
        material: Cesium.Color.RED.withAlpha(0.9),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      // 标签也使用 CallbackProperty 避免每帧创建 ConstantProperty
      label: {
        text: new Cesium.CallbackProperty(() => {
          return `无人机\n高度: ${interpolatedPos.altitude.toFixed(0)}m\n速度: ${interpolatedPos.speed.toFixed(1)}m/s`
        }, false) as unknown as Cesium.Property,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        backgroundPadding: new Cesium.Cartesian2(8, 4),
      },
    })
  }
  
  /**
   * 创建轨迹路径（优化：增量缓存已飞过的位置，避免每帧重建整个数组）
   */
  const createPathEntity = () => {
    pathEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const idx = currentIndex.value
          if (idx === cachedPathIndex) return cachedPathPositions
          
          if (idx > cachedPathIndex && cachedPathIndex >= 0) {
            // 增量追加新点（正向播放的常见路径）
            for (let i = cachedPathIndex + 1; i <= idx; i++) {
              const pos = trajectory[i]
              if (pos) {
                cachedPathPositions.push(
                  Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude)
                )
              }
            }
          } else {
            // 全量重建（回退 seek 或首次）
            cachedPathPositions = trajectory.slice(0, idx + 1).map(pos =>
              Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude)
            )
          }
          cachedPathIndex = idx
          return cachedPathPositions
        }, false),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.CYAN.withAlpha(0.8),
        }),
        clampToGround: false,
      },
    })
  }
  
  /**
   * 更新相机跟随位置
   */
  const updateCameraFollow = () => {
    const pos = interpolatedPos
    const heading = Cesium.Math.toRadians(pos.heading)
    
    // 计算相机位置：在无人机后方上方
    const cameraDistance = 200
    const cameraHeight = 100
    
    const offsetX = -Math.sin(heading) * cameraDistance
    const offsetY = -Math.cos(heading) * cameraDistance
    
    const metersPerDegreeLat = 111320
    const metersPerDegreeLon = metersPerDegreeLat * Math.cos(Cesium.Math.toRadians(pos.latitude))
    
    const cameraLongitude = pos.longitude + offsetX / metersPerDegreeLon
    const cameraLatitude = pos.latitude + offsetY / metersPerDegreeLat
    const cameraAltitude = pos.altitude + cameraHeight
    
    const cameraPosition = Cesium.Cartesian3.fromDegrees(cameraLongitude, cameraLatitude, cameraAltitude)
    const dronePosition = Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude)
    
    const direction = Cesium.Cartesian3.subtract(dronePosition, cameraPosition, new Cesium.Cartesian3())
    Cesium.Cartesian3.normalize(direction, direction)
    
    const up = Cesium.Cartesian3.normalize(cameraPosition, new Cesium.Cartesian3())
    
    viewer.camera.setView({
      destination: cameraPosition,
      orientation: {
        direction: direction,
        up: up,
      },
    })
  }
  
  /**
   * 动画循环（使用浮点索引实现平滑插值动画）
   */
  const animate = () => {
    if (!isPlaying.value || isPaused.value) return
    
    const now = Date.now()
    
    if (lastUpdateTime === null) {
      lastUpdateTime = now
    }
    
    const deltaTime = (now - lastUpdateTime) / 1000
    lastUpdateTime = now
    
    // 浮点累积进度：支持任意速度倍率（包括 0.5x 慢速）
    const indexStep = deltaTime * speedMultiplier.value * 10
    fractionalIndex += indexStep
    
    if (fractionalIndex >= trajectory.length - 1) {
      // 到达终点
      fractionalIndex = trajectory.length - 1
      currentIndex.value = trajectory.length - 1
      updateInterpolatedPosition()
      if (isFollowing.value) updateCameraFollow()
      stop()
      return
    }
    
    currentIndex.value = Math.floor(fractionalIndex)
    updateInterpolatedPosition()
    
    if (isFollowing.value) {
      updateCameraFollow()
    }
    
    animationFrameId = requestAnimationFrame(animate)
  }
  
  /**
   * 播放
   */
  const play = () => {
    if (isPlaying.value && !isPaused.value) return
    
    if (!droneEntity) {
      createDroneEntity()
      createPathEntity()
    }
    
    isPlaying.value = true
    isPaused.value = false
    lastUpdateTime = null
    
    animate()
  }
  
  /**
   * 暂停
   */
  const pause = () => {
    isPaused.value = true
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }
  
  /**
   * 继续
   */
  const resume = () => {
    if (!isPaused.value) return
    isPaused.value = false
    lastUpdateTime = null
    animate()
  }
  
  /**
   * 停止
   */
  const stop = () => {
    isPlaying.value = false
    isPaused.value = false
    
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    
    lastUpdateTime = null
  }
  
  /**
   * 重置
   */
  const reset = () => {
    stop()
    currentIndex.value = 0
    fractionalIndex = 0
    cachedPathIndex = -1
    cachedPathPositions = []
    updateInterpolatedPosition()
  }
  
  /**
   * 跳转到指定进度（0-100）
   */
  const seekToProgress = (progressValue: number) => {
    const targetIndex = (progressValue / 100) * (trajectory.length - 1)
    fractionalIndex = Math.max(0, Math.min(targetIndex, trajectory.length - 1))
    currentIndex.value = Math.floor(fractionalIndex)
    // 重置路径缓存以正确处理回退
    cachedPathIndex = -1
    cachedPathPositions = []
    updateInterpolatedPosition()
  }
  
  /**
   * 跳转到指定索引
   */
  const seekToIndex = (index: number) => {
    fractionalIndex = Math.max(0, Math.min(index, trajectory.length - 1))
    currentIndex.value = Math.floor(fractionalIndex)
    cachedPathIndex = -1
    cachedPathPositions = []
    updateInterpolatedPosition()
  }
  
  /**
   * 设置播放速度
   */
  const setSpeed = (speed: number) => {
    speedMultiplier.value = Math.max(0.1, Math.min(speed, 10))
  }
  
  /**
   * 开启相机跟随无人机
   */
  const followDrone = () => {
    if (!droneEntity) return
    
    isFollowing.value = true
    updateCameraFollow()
  }
  
  /**
   * 取消跟随
   */
  const unfollowDrone = () => {
    isFollowing.value = false
  }
  
  /**
   * 飞到无人机位置
   */
  const flyToDrone = () => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        interpolatedPos.longitude,
        interpolatedPos.latitude,
        interpolatedPos.altitude + 500
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
      duration: 2,
    })
  }
  
  /**
   * 清除所有实体
   */
  const clear = () => {
    stop()
    
    if (droneEntity) {
      viewer.entities.remove(droneEntity)
      droneEntity = null
    }
    
    if (pathEntity) {
      viewer.entities.remove(pathEntity)
      pathEntity = null
    }
    
    cachedPathPositions = []
    cachedPathIndex = -1
  }
  
  /**
   * 销毁
   */
  const destroy = () => {
    clear()
  }
  
  return {
    // 状态
    isPlaying,
    isPaused,
    currentIndex,
    currentPosition,
    progress,
    totalDuration,
    currentTime,
    speedMultiplier,
    isFollowing,
    
    // 方法
    play,
    pause,
    resume,
    stop,
    reset,
    seekToProgress,
    seekToIndex,
    setSpeed,
    followDrone,
    unfollowDrone,
    flyToDrone,
    clear,
    destroy,
  }
}
