<template>
  <div class="patrol-panel">
    <div class="panel-header">
      <h3>无人机巡查控制</h3>
    </div>

    <!-- 巡查场景选择 -->
    <div class="control-section">
      <label>巡查场景：</label>
      <select v-model="selectedScene" @change="onSceneChange" :disabled="isPatrolling">
        <option value="industry">🏭 工业园区安全巡查</option>
        <option value="river">🌊 河道环境巡查</option>
        <option value="solar">☀️ 光伏电站巡检</option>
      </select>
    </div>

    <!-- 巡查控制按钮 -->
    <div class="control-section">
      <div class="button-group">
        <button
          @click="$emit('start')"
          :disabled="isPatrolling && !isPaused"
          class="btn-primary"
        >
          ▶ 开始巡查
        </button>
        <button
          @click="$emit('pause')"
          :disabled="!isPatrolling || isPaused"
          class="btn-warning"
        >
          ⏸ 暂停
        </button>
        <button
          @click="$emit('resume')"
          :disabled="!isPaused"
          class="btn-success"
        >
          ▶ 继续
        </button>
        <button
          @click="$emit('stop')"
          :disabled="!isPatrolling && !isPaused"
          class="btn-danger"
        >
          ⏹ 终止
        </button>
      </div>
    </div>

    <!-- 整体进度 -->
    <div class="control-section">
      <label>巡查进度：{{ completedCount }}/{{ totalWaypoints }}</label>
      <div class="progress-bar-wrap">
        <div class="progress-bar" :style="{ width: overallProgress + '%' }"></div>
      </div>
    </div>

    <!-- 悬停进度 -->
    <div class="control-section" v-if="isHovering && currentWaypoint">
      <label>正在巡查：{{ currentWaypoint.name }}</label>
      <div class="hover-info">
        <span class="inspect-badge" :class="currentWaypoint.inspectType">
          {{ inspectTypeLabel(currentWaypoint.inspectType) }}
        </span>
        <span class="hover-desc">{{ currentWaypoint.description }}</span>
      </div>
      <div class="progress-bar-wrap hover-progress">
        <div class="progress-bar hover-bar" :style="{ width: hoverProgress + '%' }"></div>
      </div>
      <button class="btn-flag" @click="onFlag">⚠️ 标记异常</button>
    </div>

    <!-- 视角控制 -->
    <div class="control-section">
      <label>视角控制：</label>
      <div class="button-group">
        <button
          @click="$emit(isFollowing ? 'unfollow' : 'follow')"
          :class="['btn-info', { active: isFollowing }]"
        >
          {{ isFollowing ? '🔴 取消跟随' : '🎯 跟随无人机' }}
        </button>
        <button @click="$emit('overview')" class="btn-info">
          🗺️ 全局视角
        </button>
      </div>
    </div>

    <!-- 巡查点列表 -->
    <div class="control-section waypoint-list-section">
      <label>巡查点列表：</label>
      <ul class="waypoint-list">
        <li
          v-for="(wp, index) in waypoints"
          :key="wp.id"
          class="waypoint-item"
          :class="{
            active: index === currentWaypointIndex,
            completed: getStatus(index) === 'completed',
            flagged: getStatus(index) === 'flagged',
          }"
          @click="$emit('flyToWaypoint', index)"
        >
          <span class="wp-index">{{ index + 1 }}</span>
          <span class="wp-status-icon">{{ statusIcon(getStatus(index)) }}</span>
          <span class="wp-name">{{ wp.name }}</span>
          <span class="wp-type" :class="wp.inspectType">
            {{ inspectTypeLabel(wp.inspectType) }}
          </span>
        </li>
      </ul>
    </div>

    <!-- 无人机状态 -->
    <div class="control-section status-section" v-if="isPatrolling">
      <label>无人机状态：</label>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">经度：</span>
          <span class="value">{{ dronePos.longitude.toFixed(6) }}°</span>
        </div>
        <div class="status-item">
          <span class="label">纬度：</span>
          <span class="value">{{ dronePos.latitude.toFixed(6) }}°</span>
        </div>
        <div class="status-item">
          <span class="label">高度：</span>
          <span class="value">{{ dronePos.altitude.toFixed(1) }} m</span>
        </div>
        <div class="status-item">
          <span class="label">状态：</span>
          <span class="value">{{ isHovering ? '悬停巡查' : '飞行中' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PropType } from 'vue'
import type { PatrolWaypoint, PatrolStatus } from '@/data/patrolRoute'

const props = defineProps({
  isPatrolling: { type: Boolean, default: false },
  isPaused: { type: Boolean, default: false },
  isHovering: { type: Boolean, default: false },
  isFollowing: { type: Boolean, default: false },
  hoverProgress: { type: Number, default: 0 },
  currentWaypointIndex: { type: Number, default: 0 },
  currentWaypoint: { type: Object as PropType<PatrolWaypoint | null>, default: null },
  totalWaypoints: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
  overallProgress: { type: Number, default: 0 },
  waypoints: { type: Array as PropType<PatrolWaypoint[]>, default: () => [] },
  waypointStatuses: { type: Array as PropType<PatrolStatus[]>, default: () => [] },
  dronePos: {
    type: Object as PropType<{ longitude: number; latitude: number; altitude: number }>,
    default: () => ({ longitude: 0, latitude: 0, altitude: 0 }),
  },
})

const emit = defineEmits([
  'start', 'pause', 'resume', 'stop',
  'follow', 'unfollow', 'overview',
  'flyToWaypoint', 'sceneChange', 'flag',
])

const selectedScene = ref('industry')

const onSceneChange = () => emit('sceneChange', selectedScene.value)

const onFlag = () => emit('flag')

const getStatus = (index: number): PatrolStatus['status'] => {
  return props.waypointStatuses[index]?.status ?? 'pending'
}

const statusIcon = (status: PatrolStatus['status']): string => {
  switch (status) {
    case 'completed': return '✅'
    case 'in-progress': return '🔄'
    case 'flagged': return '⚠️'
    default: return '⬜'
  }
}

const inspectTypeLabel = (type: PatrolWaypoint['inspectType']): string => {
  switch (type) {
    case 'thermal': return '红外'
    case 'photo': return '拍照'
    case 'visual': return '目视'
  }
}
</script>

<style scoped>
.patrol-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 380px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  z-index: 1000;
  max-height: 92vh;
  overflow-y: auto;
}

.panel-header {
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e0e0e0;
}

.panel-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.control-section {
  margin-bottom: 18px;
}

.control-section label {
  display: block;
  margin-bottom: 6px;
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
}

select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

button {
  flex: 1;
  min-width: 60px;
  padding: 8px 10px;
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

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary { background: #4CAF50; color: white; }
.btn-warning { background: #FF9800; color: white; }
.btn-success { background: #2196F3; color: white; }
.btn-danger { background: #f44336; color: white; }
.btn-info { background: #00BCD4; color: white; }
.btn-info.active { background: #00838F; }

.btn-flag {
  margin-top: 8px;
  background: #FF5722;
  color: white;
  flex: none;
  width: 100%;
}

/* 进度条 */
.progress-bar-wrap {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 4px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.hover-progress {
  height: 6px;
  margin-top: 8px;
}

.hover-bar {
  background: linear-gradient(90deg, #2196F3, #03A9F4);
}

.hover-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.hover-desc {
  font-size: 12px;
  color: #666;
}

/* 巡查类型标签 */
.inspect-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
}

.inspect-badge.thermal { background: #f44336; }
.inspect-badge.photo { background: #2196F3; }
.inspect-badge.visual { background: #4CAF50; }

/* 巡查点列表 */
.waypoint-list-section {
  max-height: 240px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.waypoint-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.waypoint-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 13px;
  border-left: 3px solid transparent;
}

.waypoint-item:hover {
  background: #f5f5f5;
}

.waypoint-item.active {
  background: #E3F2FD;
  border-left-color: #2196F3;
}

.waypoint-item.completed {
  color: #4CAF50;
}

.waypoint-item.flagged {
  color: #FF5722;
  background: #FFF3E0;
}

.wp-index {
  width: 20px;
  height: 20px;
  background: #9E9E9E;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.waypoint-item.completed .wp-index { background: #4CAF50; }
.waypoint-item.active .wp-index { background: #2196F3; }
.waypoint-item.flagged .wp-index { background: #FF5722; }

.wp-status-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.wp-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wp-type {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  color: white;
  flex-shrink: 0;
}

.wp-type.thermal { background: #f44336; }
.wp-type.photo { background: #2196F3; }
.wp-type.visual { background: #4CAF50; }

/* 状态网格 */
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.status-item {
  font-size: 13px;
}

.status-item .label {
  color: #888;
}

.status-item .value {
  color: #333;
  font-weight: 500;
}
</style>
