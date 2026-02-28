<template>
  <div class="control-panel">
    <div class="panel-header">
      <h3>无人机轨迹回放控制</h3>
      <button class="close-btn" @click="$emit('close')" v-if="showClose">✕</button>
    </div>

    <!-- 轨迹选择 -->
    <div class="control-section">
      <label>选择轨迹：</label>
      <select v-model="selectedTrajectory" @change="onTrajectoryChange" :disabled="isPlaying">
        <option value="rectangular">矩形巡航</option>
        <option value="spiral">螺旋上升</option>
        <option value="terrainFollow">地形跟随</option>
      </select>
    </div>

    <!-- 播放控制 -->
    <div class="control-section">
      <div class="button-group">
        <button 
          @click="onPlay" 
          :disabled="isPlaying && !isPaused"
          class="btn-primary"
        >
          ▶ 播放
        </button>
        <button 
          @click="onPause" 
          :disabled="!isPlaying || isPaused"
          class="btn-warning"
        >
          ⏸ 暂停
        </button>
        <button 
          @click="onResume" 
          :disabled="!isPaused"
          class="btn-success"
        >
          ▶ 继续
        </button>
        <button 
          @click="onStop" 
          :disabled="!isPlaying && !isPaused"
          class="btn-danger"
        >
          ⏹ 停止
        </button>
        <button 
          @click="onReset"
          class="btn-secondary"
        >
          ↻ 重置
        </button>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="control-section">
      <label>播放进度：{{ progress.toFixed(1) }}%</label>
      <input 
        type="range" 
        min="0" 
        max="100" 
        step="0.1" 
        v-model.number="progressValue"
        @input="onSeek"
        class="progress-slider"
      />
      <div class="time-info">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(totalDuration) }}</span>
      </div>
    </div>

    <!-- 速度控制 -->
    <div class="control-section">
      <label>播放速度：{{ speed }}x</label>
      <div class="speed-controls">
        <button 
          v-for="s in speedOptions" 
          :key="s"
          @click="onSpeedChange(s)"
          :class="['speed-btn', { active: speed === s }]"
        >
          {{ s }}x
        </button>
      </div>
    </div>

    <!-- 视角控制 -->
    <div class="control-section">
      <label>视角控制：</label>
      <div class="button-group">
        <button 
          @click="onToggleFollow" 
          :class="['btn-info', { active: isFollowing }]"
        >
          {{ isFollowing ? '🔴 取消跟随' : '🎯 跟随无人机' }}
        </button>
        <button @click="onFlyTo" class="btn-info">
          ✈️ 飞到无人机
        </button>
      </div>
      <div v-if="isFollowing" class="follow-hint">
        相机正在实时跟随无人机
      </div>
    </div>

    <!-- 无人机状态信息 -->
    <div class="control-section status-section" v-if="currentPosition">
      <label>无人机状态：</label>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">经度：</span>
          <span class="value">{{ currentPosition.longitude.toFixed(6) }}°</span>
        </div>
        <div class="status-item">
          <span class="label">纬度：</span>
          <span class="value">{{ currentPosition.latitude.toFixed(6) }}°</span>
        </div>
        <div class="status-item">
          <span class="label">高度：</span>
          <span class="value">{{ currentPosition.altitude.toFixed(1) }} m</span>
        </div>
        <div class="status-item">
          <span class="label">速度：</span>
          <span class="value">{{ currentPosition.speed.toFixed(1) }} m/s</span>
        </div>
        <div class="status-item">
          <span class="label">航向：</span>
          <span class="value">{{ currentPosition.heading.toFixed(1) }}°</span>
        </div>
        <div class="status-item">
          <span class="label">俯仰：</span>
          <span class="value">{{ currentPosition.pitch.toFixed(1) }}°</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import type { DronePosition } from '@/data/droneTrajectory'

const props = defineProps({
  isPlaying: {
    type: Boolean,
    default: false,
  },
  isPaused: {
    type: Boolean,
    default: false,
  },
  isFollowing: {
    type: Boolean,
    default: false,
  },
  progress: {
    type: Number,
    default: 0,
  },
  currentTime: {
    type: Number,
    default: 0,
  },
  totalDuration: {
    type: Number,
    default: 0,
  },
  speed: {
    type: Number,
    default: 1,
  },
  currentPosition: {
    type: Object as PropType<DronePosition | null>,
    default: null,
  },
  showClose: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'play',
  'pause',
  'resume',
  'stop',
  'reset',
  'seek',
  'speedChange',
  'follow',
  'unfollow',
  'flyTo',
  'trajectoryChange',
  'close',
])

const selectedTrajectory = ref('rectangular')
const progressValue = ref(0)
const speedOptions = [0.5, 1, 2, 5, 10]

// 同步进度值
watch(() => props.progress, (val) => {
  progressValue.value = val
})

const onPlay = () => emit('play')
const onPause = () => emit('pause')
const onResume = () => emit('resume')
const onStop = () => emit('stop')
const onReset = () => emit('reset')
const onSeek = () => emit('seek', progressValue.value)
const onSpeedChange = (speed: number) => emit('speedChange', speed)
const onToggleFollow = () => {
  if (props.isFollowing) {
    emit('unfollow')
  } else {
    emit('follow')
  }
}
const onFlyTo = () => emit('flyTo')
const onTrajectoryChange = () => emit('trajectoryChange', selectedTrajectory.value)

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 360px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  z-index: 1000;
  max-height: 92%;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.panel-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.control-section {
  margin-bottom: 20px;
}

.control-section label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
  font-size: 14px;
}

select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

select:hover:not(:disabled) {
  border-color: #999;
}

select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

button {
  flex: 1;
  min-width: 60px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-warning {
  background: #FF9800;
  color: white;
}

.btn-success {
  background: #2196F3;
  color: white;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-secondary {
  background: #9E9E9E;
  color: white;
}

.btn-info {
  background: #00BCD4;
  color: white;
}

.progress-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  cursor: pointer;
}

.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4CAF50;
  cursor: pointer;
  transition: all 0.2s;
}

.progress-slider::-webkit-slider-thumb:hover {
  width: 20px;
  height: 20px;
  background: #45a049;
}

.progress-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #4CAF50;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.progress-slider::-moz-range-thumb:hover {
  width: 20px;
  height: 20px;
  background: #45a049;
}

.time-info {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
  color: #666;
}

.speed-controls {
  display: flex;
  gap: 6px;
}

.speed-btn {
  flex: 1;
  padding: 6px 10px;
  background: #f5f5f5;
  color: #333;
  border: 2px solid transparent;
  font-size: 12px;
}

.speed-btn.active {
  background: #4CAF50;
  color: white;
  border-color: #45a049;
}

.btn-info.active {
  background: #f44336;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(244, 67, 54, 0);
  }
}

.follow-hint {
  margin-top: 8px;
  padding: 6px 10px;
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-section {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-item .label {
  font-size: 11px;
  color: #666;
  font-weight: 500;
}

.status-item .value {
  font-size: 14px;
  color: #333;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

/* 滚动条样式 */
.control-panel::-webkit-scrollbar {
  width: 6px;
}

.control-panel::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.control-panel::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.control-panel::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
