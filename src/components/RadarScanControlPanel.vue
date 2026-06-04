<template>
  <div class="radar-control-panel">
    <h3>📡 雷达三维扫描</h3>

    <!-- 场景预设 -->
    <div class="control-row">
      <label>场景预设</label>
      <div class="preset-options">
        <button
          v-for="(preset, index) in presets"
          :key="index"
          class="preset-btn"
          :class="{ active: currentPreset === index }"
          @click="$emit('switch-preset', index)"
        >
          <span class="preset-name">{{ preset.name }}</span>
          <span class="preset-desc">{{ preset.description }}</span>
        </button>
      </div>
    </div>

    <!-- 扫描控制 -->
    <div class="control-row">
      <label class="switch-label">
        <span>扫描动画</span>
        <button class="toggle-btn" :class="{ active: isAnimating }" @click="$emit('toggle-animation')">
          {{ isAnimating ? '⏸ 暂停' : '▶ 继续' }}
        </button>
      </label>
    </div>

    <!-- 扫描速度 -->
    <div class="control-row">
      <label>扫描速度：{{ speed }}°/s</label>
      <input
        type="range"
        min="5"
        max="360"
        step="5"
        :value="speed"
        @input="$emit('set-speed', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 波束宽度 -->
    <div class="control-row">
      <label>波束宽度：{{ beamWidth }}°</label>
      <input
        type="range"
        min="5"
        max="90"
        step="1"
        :value="beamWidth"
        @input="$emit('set-beam-width', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 扫描半径 -->
    <div class="control-row">
      <label>扫描半径：{{ radius >= 1000 ? (radius / 1000).toFixed(1) + 'km' : radius + 'm' }}</label>
      <input
        type="range"
        min="200"
        max="10000"
        step="100"
        :value="radius"
        @input="$emit('set-radius', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 雷达高度 -->
    <div class="control-row">
      <label>雷达高度：{{ height }}m</label>
      <input
        type="range"
        min="20"
        max="500"
        step="10"
        :value="height"
        @input="$emit('set-height', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 透明度 -->
    <div class="control-row">
      <label>透明度：{{ Math.round(opacity * 100) }}%</label>
      <input
        type="range"
        min="10"
        max="100"
        step="5"
        :value="Math.round(opacity * 100)"
        @input="$emit('set-opacity', Number(($event.target as HTMLInputElement).value) / 100)"
      />
    </div>

    <!-- 拖尾长度 -->
    <div class="control-row">
      <label>拖尾长度：{{ trailLength }}°</label>
      <input
        type="range"
        min="0"
        max="270"
        step="10"
        :value="trailLength"
        @input="$emit('set-trail-length', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 距离环数 -->
    <div class="control-row">
      <label>距离环数：{{ ringCount }}</label>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        :value="ringCount"
        @input="$emit('set-ring-count', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 扫描颜色 -->
    <div class="control-row">
      <label>扫描颜色</label>
      <div class="color-options">
        <button
          v-for="c in colorPresets"
          :key="c.value"
          class="color-btn"
          :class="{ active: scanColor === c.value }"
          @click="$emit('set-color', c.value)"
        >
          <span class="color-dot" :style="{ background: c.value }"></span>
          {{ c.label }}
        </button>
      </div>
    </div>

    <!-- 图层开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>雷达锥体</span>
        <input type="checkbox" :checked="showCone" @change="$emit('toggle-cone')" />
      </label>
    </div>
    <div class="control-row">
      <label class="switch-label">
        <span>距离环线</span>
        <input type="checkbox" :checked="showRings" @change="$emit('toggle-rings')" />
      </label>
    </div>
    <div class="control-row">
      <label class="switch-label">
        <span>探测目标</span>
        <input type="checkbox" :checked="showTargets" @change="$emit('toggle-targets')" />
      </label>
    </div>
    <div class="control-row">
      <label class="switch-label">
        <span>扫描拖尾</span>
        <input type="checkbox" :checked="showTrail" @change="$emit('toggle-trail')" />
      </label>
    </div>

    <!-- 实时状态 -->
    <div class="status-panel">
      <label>实时状态</label>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-value">{{ Math.round(currentHeading) }}°</span>
          <span class="stat-label">当前方位</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ speed }}°/s</span>
          <span class="stat-label">转速</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ rpm }}</span>
          <span class="stat-label">RPM</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ targetCount }}</span>
          <span class="stat-label">目标数</span>
        </div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <label>目标图例</label>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background: #ff0000"></span>
          <span>飞行器</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #00ffff"></span>
          <span>舰船</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ffa500"></span>
          <span>车辆</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ffff00"></span>
          <span>未知</span>
        </div>
      </div>
    </div>

    <!-- 功能按钮 -->
    <div class="control-row actions">
      <button class="action-btn" @click="$emit('fly-to')">📍 定位雷达</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RADAR_PRESETS } from '@/data/radarScan'

const props = defineProps<{
  isAnimating: boolean
  currentHeading: number
  speed: number
  beamWidth: number
  radius: number
  height: number
  opacity: number
  scanColor: string
  trailLength: number
  ringCount: number
  showCone: boolean
  showRings: boolean
  showTargets: boolean
  showTrail: boolean
  currentPreset: number
  targetCount: number
}>()

defineEmits<{
  'toggle-animation': []
  'toggle-cone': []
  'toggle-rings': []
  'toggle-targets': []
  'toggle-trail': []
  'set-speed': [value: number]
  'set-beam-width': [value: number]
  'set-radius': [value: number]
  'set-height': [value: number]
  'set-opacity': [value: number]
  'set-trail-length': [value: number]
  'set-ring-count': [value: number]
  'set-color': [value: string]
  'switch-preset': [index: number]
  'fly-to': []
}>()

const presets = RADAR_PRESETS

const colorPresets = [
  { label: '绿色', value: '#00ff00' },
  { label: '青色', value: '#00ffff' },
  { label: '琥珀', value: '#ffaa00' },
  { label: '红色', value: '#ff4444' },
]

const rpm = computed(() => (props.speed / 360 * 60).toFixed(1))
</script>

<style scoped lang="scss">
.radar-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(10, 15, 30, 0.92);
  border: 1px solid rgba(0, 255, 100, 0.3);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 255, 100, 0.1), inset 0 0 30px rgba(0, 255, 100, 0.02);
  min-width: 260px;
  max-width: 300px;
  z-index: 100;
  font-size: 14px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  color: #d0f0d0;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 100, 0.3);
    border-radius: 2px;
  }

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #00ff88;
    text-shadow: 0 0 8px rgba(0, 255, 100, 0.3);
  }
}

.control-row {
  margin-bottom: 12px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #99ccaa;
    font-size: 13px;
  }

  input[type='range'] {
    width: 100%;
    cursor: pointer;
    accent-color: #00dd66;
  }
}

.switch-label {
  display: flex !important;
  align-items: center;
  justify-content: space-between;

  span {
    color: #c0e8c0;
    font-weight: 500;
  }

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #00dd66;
  }
}

.toggle-btn {
  padding: 4px 12px;
  border: 1px solid rgba(0, 255, 100, 0.4);
  border-radius: 6px;
  background: rgba(0, 255, 100, 0.1);
  color: #00ff88;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &.active {
    background: rgba(0, 255, 100, 0.2);
    border-color: #00ff88;
  }

  &:hover {
    background: rgba(0, 255, 100, 0.25);
  }
}

.preset-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 12px;
  border: 1px solid rgba(0, 255, 100, 0.2);
  border-radius: 8px;
  background: rgba(0, 255, 100, 0.05);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(0, 255, 100, 0.4);
    background: rgba(0, 255, 100, 0.1);
  }

  &.active {
    border-color: #00ff88;
    background: rgba(0, 255, 100, 0.15);
    box-shadow: 0 0 8px rgba(0, 255, 100, 0.15);
  }
}

.preset-name {
  font-weight: 500;
  font-size: 13px;
  color: #c0eec0;
}

.preset-desc {
  font-size: 11px;
  color: #779977;
  margin-top: 2px;
}

.color-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  cursor: pointer;
  font-size: 12px;
  color: #aaddaa;
  transition: all 0.2s;

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  &.active {
    border-color: rgba(0, 255, 100, 0.6);
    background: rgba(0, 255, 100, 0.1);
  }
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 4px currentColor;
}

.status-panel {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(0, 255, 100, 0.03);
  border: 1px solid rgba(0, 255, 100, 0.15);
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 8px;
    color: #99ccaa;
    font-size: 13px;
  }
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-item {
  text-align: center;
  padding: 6px;
  background: rgba(0, 255, 100, 0.05);
  border-radius: 6px;

  .stat-value {
    display: block;
    font-size: 16px;
    font-weight: bold;
    color: #00ff88;
    font-family: 'Courier New', monospace;
    text-shadow: 0 0 6px rgba(0, 255, 100, 0.3);
  }

  .stat-label {
    display: block;
    font-size: 11px;
    color: #779977;
    margin-top: 2px;
  }
}

.legend {
  margin-bottom: 12px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #99ccaa;
    font-size: 13px;
  }
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #aaddaa;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(0, 255, 100, 0.3);
  border-radius: 8px;
  background: rgba(0, 255, 100, 0.1);
  color: #00ff88;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 255, 100, 0.2);
    border-color: #00ff88;
    box-shadow: 0 0 6px rgba(0, 255, 100, 0.2);
  }
}
</style>
