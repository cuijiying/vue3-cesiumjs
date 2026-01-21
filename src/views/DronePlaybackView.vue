<template>
  <div class="drone-playback-view">
    <div id="cesiumContainer" class="cesium-container"></div>
    
    <DroneControlPanel
      v-if="playbackReady && playbackState"
      :isPlaying="playbackState.isPlaying"
      :isPaused="playbackState.isPaused"
      :progress="playbackState.progress"
      :currentTime="playbackState.currentTime"
      :totalDuration="playbackState.totalDuration"
      :speed="playbackState.speed"
      :currentPosition="playbackState.currentPosition"
      @play="handlePlay"
      @pause="handlePause"
      @resume="handleResume"
      @stop="handleStop"
      @reset="handleReset"
      @seek="handleSeek"
      @speedChange="handleSpeedChange"
      @follow="handleFollow"
      @flyTo="handleFlyTo"
      @trajectoryChange="changeTrajectory"
    />

    <div class="loading-overlay" v-if="!isReady">
      <div class="loading-spinner"></div>
      <p>正在加载 Cesium 地图...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'
import { useCesiumViewer } from '@/composables/useCesiumViewer'
import { useDronePlayback } from '@/composables/useDronePlayback'
import DroneControlPanel from '@/components/DroneControlPanel.vue'
import { trajectoryPresets } from '@/data/droneTrajectory'

const { viewer, isReady } = useCesiumViewer('cesiumContainer')
const playback = ref<ReturnType<typeof useDronePlayback> | null>(null)
const playbackReady = ref(false)
const currentTrajectoryKey = ref<keyof typeof trajectoryPresets>('rectangular')

// 计算 playback 状态
const playbackState = computed(() => {
  if (!playback.value) return null
  const p = playback.value
  return {
    isPlaying: p.isPlaying,
    isPaused: p.isPaused,
    progress: p.progress,
    currentTime: p.currentTime,
    totalDuration: p.totalDuration,
    speed: p.speedMultiplier,
    currentPosition: p.currentPosition,
  }
})

// 事件处理函数
const handlePlay = () => playback.value?.play()
const handlePause = () => playback.value?.pause()
const handleResume = () => playback.value?.resume()
const handleStop = () => playback.value?.stop()
const handleReset = () => playback.value?.reset()
const handleSeek = (progress: number) => playback.value?.seekToProgress(progress)
const handleSpeedChange = (speed: number) => playback.value?.setSpeed(speed)
const handleFollow = () => playback.value?.followDrone()
const handleFlyTo = () => playback.value?.flyToDrone()

// 初始化轨迹回放
const initPlayback = () => {
  if (!viewer.value) return

  const trajectory = trajectoryPresets[currentTrajectoryKey.value].data

  // 如果已有播放器，先销毁
  if (playback.value) {
    playback.value.destroy()
  }

  playback.value = useDronePlayback({
    viewer: viewer.value,
    trajectory: trajectory,
    speedMultiplier: 1,
  })

  playbackReady.value = true
}

// 切换轨迹
const changeTrajectory = (trajectoryKey: string) => {
  if (trajectoryKey in trajectoryPresets) {
    currentTrajectoryKey.value = trajectoryKey as keyof typeof trajectoryPresets
    initPlayback()
  }
}

// 监听 viewer 初始化完成
watch(isReady, (ready) => {
  if (ready) {
    setTimeout(() => {
      initPlayback()
    }, 100)
  }
})

onUnmounted(() => {
  if (playback.value) {
    playback.value.destroy()
  }
})
</script>

<style scoped>
.drone-playback-view {
  width: 100vw;
  height: 100vh;
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
