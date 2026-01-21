import { ref, computed, watch, type Ref } from 'vue'
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
  
  // 计算属性
  const currentPosition = computed(() => trajectory[currentIndex.value])
  const progress = computed(() => (currentIndex.value / (trajectory.length - 1)) * 100)
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
  
  /**
   * 创建无人机实体
   */
  const createDroneEntity = () => {
    if (!currentPosition.value) return
    
    const position = Cesium.Cartesian3.fromDegrees(
      currentPosition.value.longitude,
      currentPosition.value.latitude,
      currentPosition.value.altitude
    )
    
    // 创建无人机模型（使用正方体代替）
    droneEntity = viewer.entities.add({
      position: position,
      orientation: new Cesium.CallbackProperty((time, result) => {
        if (!currentPosition.value) return result
        
        const heading = Cesium.Math.toRadians(currentPosition.value.heading)
        const pitch = Cesium.Math.toRadians(currentPosition.value.pitch)
        const roll = Cesium.Math.toRadians(currentPosition.value.roll)
        
        return Cesium.Transforms.headingPitchRollQuaternion(
          Cesium.Cartesian3.fromDegrees(
            currentPosition.value.longitude,
            currentPosition.value.latitude,
            currentPosition.value.altitude
          ),
          new Cesium.HeadingPitchRoll(heading, pitch, roll),
          Cesium.Ellipsoid.WGS84,
          undefined,
          result
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
      // 添加标签
      label: {
        text: '无人机',
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
   * 创建轨迹路径
   */
  const createPathEntity = () => {
    const positions = trajectory.map(pos =>
      Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, pos.altitude)
    )
    
    pathEntity = viewer.entities.add({
      polyline: {
        positions: positions,
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
   * 更新无人机位置
   */
  const updateDronePosition = () => {
    if (!droneEntity || !currentPosition.value) return
    
    const position = Cesium.Cartesian3.fromDegrees(
      currentPosition.value.longitude,
      currentPosition.value.latitude,
      currentPosition.value.altitude
    )
    
    droneEntity.position = new Cesium.ConstantPositionProperty(position)
    
    // 更新标签信息
    if (droneEntity.label) {
      droneEntity.label.text = new Cesium.ConstantProperty(
        `无人机\n高度: ${currentPosition.value.altitude.toFixed(0)}m\n速度: ${currentPosition.value.speed.toFixed(1)}m/s`
      )
    }
  }
  
  /**
   * 动画循环
   */
  const animate = () => {
    if (!isPlaying.value || isPaused.value) return
    
    const now = Date.now()
    
    if (lastUpdateTime === null) {
      lastUpdateTime = now
    }
    
    const deltaTime = (now - lastUpdateTime) / 1000 // 转换为秒
    lastUpdateTime = now
    
    // 根据速度倍数计算应该前进的索引数
    // 每秒前进的索引数 = 速度倍数 * 基础速度（每秒10个点）
    const indexStep = deltaTime * speedMultiplier.value * 10
    
    let nextIndex = currentIndex.value + Math.max(1, Math.floor(indexStep))
    
    if (nextIndex >= trajectory.length - 1) {
      // 到达终点
      currentIndex.value = trajectory.length - 1
      updateDronePosition()
      stop()
      return
    }
    
    currentIndex.value = nextIndex
    updateDronePosition()
    
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
    updateDronePosition()
  }
  
  /**
   * 跳转到指定进度（0-100）
   */
  const seekToProgress = (progress: number) => {
    const targetIndex = Math.floor((progress / 100) * (trajectory.length - 1))
    currentIndex.value = Math.max(0, Math.min(targetIndex, trajectory.length - 1))
    updateDronePosition()
  }
  
  /**
   * 跳转到指定索引
   */
  const seekToIndex = (index: number) => {
    currentIndex.value = Math.max(0, Math.min(index, trajectory.length - 1))
    updateDronePosition()
  }
  
  /**
   * 设置播放速度
   */
  const setSpeed = (speed: number) => {
    speedMultiplier.value = Math.max(0.1, Math.min(speed, 10))
  }
  
  /**
   * 跟随无人机视角
   */
  const followDrone = () => {
    if (!droneEntity || !currentPosition.value) return
    
    viewer.trackedEntity = droneEntity
  }
  
  /**
   * 取消跟随
   */
  const unfollowDrone = () => {
    viewer.trackedEntity = undefined
  }
  
  /**
   * 飞到无人机位置
   */
  const flyToDrone = () => {
    if (!currentPosition.value) return
    
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        currentPosition.value.longitude,
        currentPosition.value.latitude,
        currentPosition.value.altitude + 500
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
