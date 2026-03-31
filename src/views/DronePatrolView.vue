<template>
  <div class="drone-patrol-view">
    <div id="cesiumContainer" class="cesium-container"></div>

    <DronePatrolPanel
      v-if="patrolReady && patrol"
      :isPatrolling="patrol.isPatrolling"
      :isPaused="patrol.isPaused"
      :isHovering="patrol.isHovering"
      :isFollowing="patrol.isFollowing"
      :hoverProgress="patrol.hoverProgress"
      :currentWaypointIndex="patrol.currentWaypointIndex"
      :currentWaypoint="patrol.currentWaypoint"
      :totalWaypoints="patrol.totalWaypoints"
      :completedCount="patrol.completedCount"
      :overallProgress="patrol.overallProgress"
      :waypoints="currentPatrolArea.waypoints"
      :waypointStatuses="patrol.waypointStatuses"
      :dronePos="patrol.dronePos"
      @start="patrol.startPatrol()"
      @pause="patrol.pausePatrol()"
      @resume="patrol.resumePatrol()"
      @stop="patrol.stopPatrol()"
      @follow="patrol.followDrone()"
      @unfollow="patrol.unfollowDrone()"
      @overview="patrol.flyToOverview()"
      @flyToWaypoint="(idx: number) => patrol!.flyToWaypoint(idx)"
      @sceneChange="changeScene"
      @flag="handleFlag"
    />

    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在加载 Cesium 地图...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { useCesiumViewer } from '@/composables/useCesiumViewer'
import { useDronePatrol } from '@/composables/useDronePatrol'
import DronePatrolPanel from '@/components/DronePatrolPanel.vue'
import { patrolPresets, type PatrolPresetKey } from '@/data/patrolRoute'

const { viewer, isReady } = useCesiumViewer('cesiumContainer')
const patrol = ref<ReturnType<typeof useDronePatrol> | null>(null)
const patrolReady = ref(false)
const currentSceneKey = ref<PatrolPresetKey>('industry')

const currentPatrolArea = computed(() => patrolPresets[currentSceneKey.value])

const initPatrol = () => {
  if (!viewer.value) return

  if (patrol.value) {
    patrol.value.destroy()
  }

  patrol.value = useDronePatrol({
    viewer: viewer.value,
    patrolArea: currentPatrolArea.value,
    flySpeed: 15,
  })

  patrolReady.value = true

  // 初始化后飞到全局视角
  setTimeout(() => {
    patrol.value?.flyToOverview()
  }, 500)
}

const changeScene = (sceneKey: string) => {
  if (sceneKey in patrolPresets) {
    currentSceneKey.value = sceneKey as PatrolPresetKey
    initPatrol()
  }
}

const handleFlag = () => {
  patrol.value?.flagCurrentWaypoint('巡查发现异常')
}

watch(isReady, (ready) => {
  if (ready) {
    setTimeout(() => {
      initPatrol()
    }, 100)
  }
})

onUnmounted(() => {
  if (patrol.value) {
    patrol.value.destroy()
  }
})
</script>

<style scoped>
.drone-patrol-view {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.cesium-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  z-index: 2000;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
