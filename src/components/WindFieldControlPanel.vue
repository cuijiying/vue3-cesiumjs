<template>
  <div class="wind-control-panel">
    <h3>🌬️ 风场图层控制</h3>

    <!-- 图层开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>显示风场</span>
        <input type="checkbox" :checked="isVisible" @change="$emit('toggle-visibility')" />
      </label>
    </div>

    <!-- 粒子数量 -->
    <div class="control-row">
      <label>粒子数量：{{ particleCount }}</label>
      <input
        type="range"
        min="200"
        max="5000"
        step="100"
        :value="particleCount"
        @input="$emit('set-particle-count', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 风速倍率 -->
    <div class="control-row">
      <label>风速倍率：{{ speedFactor.toFixed(1) }}x</label>
      <input
        type="range"
        min="10"
        max="300"
        step="10"
        :value="Math.round(speedFactor * 100)"
        @input="$emit('set-speed-factor', Number(($event.target as HTMLInputElement).value) / 100)"
      />
    </div>

    <!-- 尾迹长度 -->
    <div class="control-row">
      <label>尾迹长度：{{ trailLabel }}</label>
      <input
        type="range"
        min="80"
        max="99"
        step="1"
        :value="Math.round(fadeOpacity * 100)"
        @input="$emit('set-fade-opacity', Number(($event.target as HTMLInputElement).value) / 100)"
      />
    </div>

    <!-- 线宽 -->
    <div class="control-row">
      <label>线宽：{{ lineWidth.toFixed(1) }}</label>
      <input
        type="range"
        min="5"
        max="40"
        step="5"
        :value="Math.round(lineWidth * 10)"
        @input="$emit('set-line-width', Number(($event.target as HTMLInputElement).value) / 10)"
      />
    </div>

    <!-- 配色方案 -->
    <div class="control-row">
      <label>配色方案</label>
      <div class="color-scale-options">
        <button
          v-for="scale in colorScales"
          :key="scale.key"
          class="color-scale-btn"
          :class="{ active: colorScale === scale.key }"
          @click="$emit('set-color-scale', scale.key)"
        >
          <span class="color-preview" :style="{ background: scale.gradient }"></span>
          <span>{{ scale.label }}</span>
        </button>
      </div>
    </div>

    <!-- 风速图例 -->
    <div class="legend" v-if="windData">
      <label>风速图例 (m/s)</label>
      <div class="legend-bar" :style="{ background: currentGradient }"></div>
      <div class="legend-labels">
        <span>0</span>
        <span>{{ (windData.maxSpeed / 2).toFixed(1) }}</span>
        <span>{{ windData.maxSpeed.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 功能按钮 -->
    <div class="control-row actions">
      <button class="action-btn" @click="$emit('fly-to')">📍 定位图层</button>
      <button class="action-btn" @click="$emit('reload')">🔄 刷新数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WindFieldData, WindColorScaleName } from '@/data/windField'

const props = defineProps<{
  isVisible: boolean
  particleCount: number
  speedFactor: number
  fadeOpacity: number
  lineWidth: number
  colorScale: WindColorScaleName
  windData: WindFieldData | null
}>()

defineEmits<{
  'toggle-visibility': []
  'set-particle-count': [value: number]
  'set-speed-factor': [value: number]
  'set-fade-opacity': [value: number]
  'set-line-width': [value: number]
  'set-color-scale': [name: WindColorScaleName]
  'fly-to': []
  'reload': []
}>()

const colorScales = [
  {
    key: 'rainbow' as const,
    label: '彩虹',
    gradient: 'linear-gradient(90deg, #0000ff, #00c8ff, #00ff64, #ffff00, #ff3200)',
  },
  {
    key: 'monochrome' as const,
    label: '灰度',
    gradient: 'linear-gradient(90deg, #646464, #c8c8c8, #ffffff)',
  },
  {
    key: 'thermal' as const,
    label: '热力',
    gradient: 'linear-gradient(90deg, #0a0050, #500078, #c83232, #ff9600, #ffff64)',
  },
]

const currentGradient = computed(() => {
  return colorScales.find((s) => s.key === props.colorScale)?.gradient ?? ''
})

const trailLabel = computed(() => {
  const v = props.fadeOpacity
  if (v < 0.88) return '短'
  if (v < 0.94) return '中'
  return '长'
})
</script>

<style scoped lang="scss">
.wind-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 240px;
  max-width: 280px;
  z-index: 10;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }
}

.control-row {
  margin-bottom: 14px;

  label {
    display: block;
    font-size: 13px;
    color: #555;
    margin-bottom: 6px;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #409eff;
  }
}

.switch-label {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #409eff;
  }
}

.color-scale-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-scale-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1.5px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
  }

  &.active {
    border-color: #409eff;
    background: #ecf5ff;
  }
}

.color-preview {
  display: inline-block;
  width: 60px;
  height: 14px;
  border-radius: 3px;
}

.legend {
  margin-bottom: 14px;
  padding: 10px;
  background: #f8f8f8;
  border-radius: 6px;

  label {
    display: block;
    font-size: 12px;
    color: #888;
    margin-bottom: 6px;
  }
}

.legend-bar {
  height: 12px;
  border-radius: 4px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: #999;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    background: #ecf5ff;
    border-color: #409eff;
    color: #409eff;
  }
}
</style>
