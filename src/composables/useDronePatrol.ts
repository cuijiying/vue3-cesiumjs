import { ref, computed, reactive } from 'vue'
import * as Cesium from 'cesium'
import type { PatrolWaypoint, PatrolStatus, PatrolArea } from '@/data/patrolRoute'

export interface DronePatrolOptions {
  viewer: Cesium.Viewer
  patrolArea: PatrolArea
  flySpeed?: number // 飞行速度（米/秒），默认15
}

/**
 * 无人机巡查 Composable
 */
export function useDronePatrol(options: DronePatrolOptions) {
  const { viewer, patrolArea } = options
  const waypoints = patrolArea.waypoints

  // 巡查状态
  const isPatrolling = ref(false)
  const isPaused = ref(false)
  const currentWaypointIndex = ref(0)
  const isHovering = ref(false) // 是否在巡查点悬停中
  const hoverProgress = ref(0) // 悬停进度 0-100
  const isFollowing = ref(false)
  const flySpeed = ref(options.flySpeed || 15)

  // 每个巡查点的状态
  const waypointStatuses = reactive<PatrolStatus[]>(
    waypoints.map((wp) => ({
      waypointId: wp.id,
      status: 'pending' as const,
    })),
  )

  // 飞行动画状态
  let animationFrameId: number | null = null
  let lastUpdateTime: number | null = null
  let hoverTimerId: ReturnType<typeof setTimeout> | null = null

  // 当前飞行段的插值进度 0~1
  let segmentProgress = 0
  // 当前阶段：'flying' | 'hovering'
  let phase: 'flying' | 'hovering' | 'idle' = 'idle'

  // 当前无人机插值位置
  const dronePos = reactive({
    longitude: waypoints[0]?.longitude ?? 0,
    latitude: waypoints[0]?.latitude ?? 0,
    altitude: waypoints[0]?.altitude ?? 0,
    heading: 0,
    speed: 0,
  })

  // Cesium 实体
  let droneEntity: Cesium.Entity | null = null
  let pathEntity: Cesium.Entity | null = null
  let routeEntity: Cesium.Entity | null = null
  let boundaryEntity: Cesium.Entity | null = null
  const waypointEntities: Cesium.Entity[] = []

  // 已飞过路径的位置缓存
  let flownPositions: Cesium.Cartesian3[] = []

  // 计算属性
  const currentWaypoint = computed(() => waypoints[currentWaypointIndex.value])
  const totalWaypoints = computed(() => waypoints.length)
  const completedCount = computed(
    () => waypointStatuses.filter((s) => s.status === 'completed' || s.status === 'flagged').length,
  )
  const overallProgress = computed(() => {
    if (waypoints.length === 0) return 0
    return (completedCount.value / waypoints.length) * 100
  })

  /**
   * 计算两个经纬度坐标间的距离（近似，米）
   */
  const calcDistance = (
    lng1: number,
    lat1: number,
    alt1: number,
    lng2: number,
    lat2: number,
    alt2: number,
  ): number => {
    const dLat = (lat2 - lat1) * 111320
    const dLng = (lng2 - lng1) * 111320 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180))
    const dAlt = alt2 - alt1
    return Math.sqrt(dLat * dLat + dLng * dLng + dAlt * dAlt)
  }

  /**
   * 创建预览路线（虚线显示整条巡查路线）
   */
  const createRoutePreview = () => {
    const positions = waypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude),
    )

    routeEntity = viewer.entities.add({
      polyline: {
        positions: positions,
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString(patrolArea.boundaryColor).withAlpha(0.6),
          dashLength: 16,
        }),
        clampToGround: false,
      },
    })
  }

  /**
   * 创建巡查点标记
   */
  const createWaypointMarkers = () => {
    waypoints.forEach((wp, index) => {
      const color =
        wp.inspectType === 'thermal'
          ? Cesium.Color.RED
          : wp.inspectType === 'photo'
            ? Cesium.Color.BLUE
            : Cesium.Color.GREEN

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude),
        point: {
          pixelSize: 12,
          color: color.withAlpha(0.8),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `${index + 1}. ${wp.name}`,
          font: '13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          showBackground: true,
          backgroundColor: color.withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15000),
        },
      })
      waypointEntities.push(entity)
    })
  }

  /**
   * 更新巡查点标记颜色（反映状态）
   */
  const updateWaypointMarkerColor = (index: number, status: PatrolStatus['status']) => {
    const entity = waypointEntities[index]
    if (!entity || !entity.point) return

    let color: Cesium.Color
    switch (status) {
      case 'completed':
        color = Cesium.Color.LIME
        break
      case 'in-progress':
        color = Cesium.Color.YELLOW
        break
      case 'flagged':
        color = Cesium.Color.ORANGE
        break
      default:
        color = Cesium.Color.GRAY
    }
    entity.point.color = new Cesium.ConstantProperty(color.withAlpha(0.9))
  }

  /**
   * 创建无人机实体
   */
  const createDroneEntity = () => {
    droneEntity = viewer.entities.add({
      position: new Cesium.CallbackProperty(() => {
        return Cesium.Cartesian3.fromDegrees(dronePos.longitude, dronePos.latitude, dronePos.altitude)
      }, false) as unknown as Cesium.PositionProperty,
      // 使用圆锥+圆柱组合表示
      cylinder: {
        length: 8,
        topRadius: 0,
        bottomRadius: 15,
        material: Cesium.Color.DODGERBLUE.withAlpha(0.85),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
      },
      label: {
        text: new Cesium.CallbackProperty(() => {
          const wp = currentWaypoint.value
          const statusText = isHovering.value ? `巡查中 ${hoverProgress.value.toFixed(0)}%` : '飞行中'
          return `无人机 [${statusText}]\n高度: ${dronePos.altitude.toFixed(0)}m`
        }, false) as unknown as Cesium.Property,
        font: '13px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -35),
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
        backgroundPadding: new Cesium.Cartesian2(8, 4),
      },
    })
  }

  /**
   * 创建已飞过的路径
   */
  const createFlownPath = () => {
    pathEntity = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          return flownPositions
        }, false),
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.CYAN,
        }),
        clampToGround: false,
      },
    })
  }

  /**
   * 更新相机跟随
   */
  const updateCameraFollow = () => {
    const heading = Cesium.Math.toRadians(dronePos.heading)
    const cameraDistance = 300
    const cameraHeight = 150

    const offsetX = -Math.sin(heading) * cameraDistance
    const offsetY = -Math.cos(heading) * cameraDistance
    const metersPerDegreeLat = 111320
    const metersPerDegreeLon =
      metersPerDegreeLat * Math.cos(Cesium.Math.toRadians(dronePos.latitude))

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        dronePos.longitude + offsetX / metersPerDegreeLon,
        dronePos.latitude + offsetY / metersPerDegreeLat,
        dronePos.altitude + cameraHeight,
      ),
      orientation: {
        direction: Cesium.Cartesian3.normalize(
          Cesium.Cartesian3.subtract(
            Cesium.Cartesian3.fromDegrees(dronePos.longitude, dronePos.latitude, dronePos.altitude),
            Cesium.Cartesian3.fromDegrees(
              dronePos.longitude + offsetX / metersPerDegreeLon,
              dronePos.latitude + offsetY / metersPerDegreeLat,
              dronePos.altitude + cameraHeight,
            ),
            new Cesium.Cartesian3(),
          ),
          new Cesium.Cartesian3(),
        ),
        up: Cesium.Cartesian3.normalize(
          Cesium.Cartesian3.fromDegrees(
            dronePos.longitude + offsetX / metersPerDegreeLon,
            dronePos.latitude + offsetY / metersPerDegreeLat,
            dronePos.altitude + cameraHeight,
          ),
          new Cesium.Cartesian3(),
        ),
      },
    })
  }

  /**
   * 飞行到下一个巡查点的动画
   */
  const flyToNextWaypoint = () => {
    const nextIndex = currentWaypointIndex.value + 1
    if (nextIndex >= waypoints.length) {
      // 巡查完成
      finishPatrol()
      return
    }

    currentWaypointIndex.value = nextIndex
    segmentProgress = 0
    phase = 'flying'

    // 标记当前巡查点为进行中
    const status = waypointStatuses[nextIndex]
    if (status) {
      status.status = 'in-progress'
      status.startTime = Date.now() / 1000
    }
    updateWaypointMarkerColor(nextIndex, 'in-progress')

    lastUpdateTime = null
    animateFlying()
  }

  /**
   * 飞行动画
   */
  const animateFlying = () => {
    if (!isPatrolling.value || isPaused.value) return

    const now = Date.now()
    if (lastUpdateTime === null) lastUpdateTime = now
    const deltaTime = (now - lastUpdateTime) / 1000
    lastUpdateTime = now

    const prevIndex = currentWaypointIndex.value - 1
    const currIndex = currentWaypointIndex.value
    const prevWp = waypoints[prevIndex < 0 ? 0 : prevIndex]
    const currWp = waypoints[currIndex]

    if (!prevWp || !currWp) return

    // 计算飞行段距离和需要时间
    const distance = calcDistance(
      prevWp.longitude, prevWp.latitude, prevWp.altitude,
      currWp.longitude, currWp.latitude, currWp.altitude,
    )
    const flightTime = distance / flySpeed.value
    segmentProgress += deltaTime / Math.max(flightTime, 0.1)

    if (segmentProgress >= 1) {
      // 到达目标巡查点
      segmentProgress = 1
      dronePos.longitude = currWp.longitude
      dronePos.latitude = currWp.latitude
      dronePos.altitude = currWp.altitude
      dronePos.speed = 0

      flownPositions.push(
        Cesium.Cartesian3.fromDegrees(currWp.longitude, currWp.latitude, currWp.altitude),
      )

      if (isFollowing.value) updateCameraFollow()

      // 开始悬停巡查
      startHovering()
      return
    }

    // 线性插值位置
    const t = segmentProgress
    dronePos.longitude = prevWp.longitude + (currWp.longitude - prevWp.longitude) * t
    dronePos.latitude = prevWp.latitude + (currWp.latitude - prevWp.latitude) * t
    dronePos.altitude = prevWp.altitude + (currWp.altitude - prevWp.altitude) * t
    dronePos.heading =
      Math.atan2(currWp.longitude - prevWp.longitude, currWp.latitude - prevWp.latitude) *
      (180 / Math.PI)
    dronePos.speed = flySpeed.value

    // 记录飞行轨迹（每 5 帧记录一个点）
    flownPositions.push(
      Cesium.Cartesian3.fromDegrees(dronePos.longitude, dronePos.latitude, dronePos.altitude),
    )

    if (isFollowing.value) updateCameraFollow()

    animationFrameId = requestAnimationFrame(animateFlying)
  }

  /**
   * 悬停巡查
   */
  const startHovering = () => {
    phase = 'hovering'
    isHovering.value = true
    hoverProgress.value = 0

    const wp = currentWaypoint.value
    if (!wp) return

    const durationMs = wp.hoverDuration * 1000
    const startTime = Date.now()

    const updateHover = () => {
      if (!isPatrolling.value) return
      if (isPaused.value) {
        // 暂停时不更新进度，等 resume 后重启
        hoverTimerId = setTimeout(updateHover, 100)
        return
      }

      const elapsed = Date.now() - startTime
      hoverProgress.value = Math.min((elapsed / durationMs) * 100, 100)

      if (elapsed >= durationMs) {
        // 悬停完毕，标记完成
        completeCurrentWaypoint()
        isHovering.value = false
        hoverProgress.value = 0
        flyToNextWaypoint()
        return
      }

      hoverTimerId = setTimeout(updateHover, 50)
    }

    hoverTimerId = setTimeout(updateHover, 50)
  }

  /**
   * 标记当前巡查点完成
   */
  const completeCurrentWaypoint = () => {
    const status = waypointStatuses[currentWaypointIndex.value]
    if (status) {
      status.status = 'completed'
      status.endTime = Date.now() / 1000
    }
    updateWaypointMarkerColor(currentWaypointIndex.value, 'completed')
  }

  /**
   * 标记当前巡查点异常
   */
  const flagCurrentWaypoint = (note: string) => {
    const status = waypointStatuses[currentWaypointIndex.value]
    if (status) {
      status.status = 'flagged'
      status.endTime = Date.now() / 1000
      status.note = note
    }
    updateWaypointMarkerColor(currentWaypointIndex.value, 'flagged')
  }

  /**
   * 巡查完成
   */
  const finishPatrol = () => {
    isPatrolling.value = false
    isPaused.value = false
    isHovering.value = false
    phase = 'idle'

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    if (hoverTimerId !== null) {
      clearTimeout(hoverTimerId)
      hoverTimerId = null
    }
  }

  /**
   * 开始巡查
   */
  const startPatrol = () => {
    if (isPatrolling.value) return

    // 初始化实体
    if (!droneEntity) {
      createRoutePreview()
      createWaypointMarkers()
      createDroneEntity()
      createFlownPath()
    }

    isPatrolling.value = true
    isPaused.value = false
    currentWaypointIndex.value = 0
    segmentProgress = 0
    phase = 'flying'
    flownPositions = []

    // 初始位置
    const startWp = waypoints[0]
    if (startWp) {
      dronePos.longitude = startWp.longitude
      dronePos.latitude = startWp.latitude
      dronePos.altitude = startWp.altitude
    }

    // 重置所有状态
    waypointStatuses.forEach((s, i) => {
      s.status = i === 0 ? 'in-progress' : 'pending'
      s.startTime = undefined
      s.endTime = undefined
      s.note = undefined
    })
    updateWaypointMarkerColor(0, 'in-progress')

    // 添加起始位置到飞行轨迹
    flownPositions.push(
      Cesium.Cartesian3.fromDegrees(dronePos.longitude, dronePos.latitude, dronePos.altitude),
    )

    // 第一个点先悬停
    const firstWpStatus = waypointStatuses[0]
    if (firstWpStatus) firstWpStatus.startTime = Date.now() / 1000
    startHovering()
  }

  /**
   * 暂停巡查
   */
  const pausePatrol = () => {
    isPaused.value = true
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  /**
   * 继续巡查
   */
  const resumePatrol = () => {
    if (!isPaused.value) return
    isPaused.value = false
    lastUpdateTime = null

    if (phase === 'flying') {
      animateFlying()
    }
    // hovering 阶段的 setTimeout 会自行恢复
  }

  /**
   * 停止巡查
   */
  const stopPatrol = () => {
    finishPatrol()
  }

  /**
   * 跟随无人机
   */
  const followDrone = () => {
    isFollowing.value = true
    updateCameraFollow()
  }

  const unfollowDrone = () => {
    isFollowing.value = false
  }

  /**
   * 飞到全局视角
   */
  const flyToOverview = () => {
    // 计算所有巡查点的中心和范围
    let minLng = Infinity, maxLng = -Infinity
    let minLat = Infinity, maxLat = -Infinity
    waypoints.forEach((wp) => {
      minLng = Math.min(minLng, wp.longitude)
      maxLng = Math.max(maxLng, wp.longitude)
      minLat = Math.min(minLat, wp.latitude)
      maxLat = Math.max(maxLat, wp.latitude)
    })

    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2
    const range = Math.max(maxLng - minLng, maxLat - minLat) * 111320 * 2.5

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, Math.max(range, 1000)),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0,
      },
      duration: 2,
    })
  }

  /**
   * 飞到指定巡查点
   */
  const flyToWaypoint = (index: number) => {
    const wp = waypoints[index]
    if (!wp) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude + 400),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 1.5,
    })
  }

  /**
   * 清理所有实体
   */
  const clear = () => {
    finishPatrol()

    if (droneEntity) {
      viewer.entities.remove(droneEntity)
      droneEntity = null
    }
    if (pathEntity) {
      viewer.entities.remove(pathEntity)
      pathEntity = null
    }
    if (routeEntity) {
      viewer.entities.remove(routeEntity)
      routeEntity = null
    }
    if (boundaryEntity) {
      viewer.entities.remove(boundaryEntity)
      boundaryEntity = null
    }
    waypointEntities.forEach((e) => viewer.entities.remove(e))
    waypointEntities.length = 0
    flownPositions = []
  }

  const destroy = () => {
    clear()
  }

  return {
    // 状态
    isPatrolling,
    isPaused,
    isHovering,
    isFollowing,
    hoverProgress,
    currentWaypointIndex,
    currentWaypoint,
    totalWaypoints,
    completedCount,
    overallProgress,
    waypointStatuses,
    dronePos,
    flySpeed,

    // 方法
    startPatrol,
    pausePatrol,
    resumePatrol,
    stopPatrol,
    flagCurrentWaypoint,
    followDrone,
    unfollowDrone,
    flyToOverview,
    flyToWaypoint,
    clear,
    destroy,
  }
}
