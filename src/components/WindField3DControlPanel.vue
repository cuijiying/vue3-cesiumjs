<template>
  <div class="wind3d-control-panel">
    <h3>🌀 三维风场控制</h3>

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
        min="100"
        max="3000"
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
        max="500"
        step="10"
        :value="Math.round(speedFactor * 100)"
        @input="$emit('set-speed-factor', Number(($event.target as HTMLInputElement).value) / 100)"
      />
    </div>

    <!-- 拖尾长度 -->
    <div class="control-row">
      <label>拖尾长度：{{ fadeOpacity.toFixed(2) }}</label>
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
        max="50"
        step="5"
        :value="Math.round(lineWidth * 10)"
        @input="$emit('set-line-width', Number(($event.target as HTMLInputElement).value) / 10)"
      />
    </div>

    <!-- 高度夸张 -->
    <div class="control-row">
      <label>高度夸张：{{ heightScale }}x</label>
      <input
        type="range"
        min="1"
        max="100"
        step="1"
        :value="heightScale"
        @input="$emit('set-height-scale', Number(($event.target as HTMLInputElement).value))"
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

    <!-- 高度层控制 -->
    <div class="control-row" v-if="windData">
      <label>高度层</label>
      <div class="level-toggles">
        <label
          v-for="(level, idx) in windData.levels"
          :key="idx"
          class="level-toggle"
        >
          <input
            type="checkbox"
            :checked="visibleLevels[idx]"
            @change="$emit('toggle-level', idx)"
          />
          <span>{{ formatAlt(level) }}</span>
        </label>
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
import type { WindField3DData, Wind3DColorScaleName } from '@/data/windField3D'

const props = defineProps<{
  isVisible: boolean
  particleCount: number
  speedFactor: number
  fadeOpacity: number
  lineWidth: number
  heightScale: number
  colorScale: Wind3DColorScaleName
  windData: WindField3DData | null
  visibleLevels: boolean[]
}>()

defineEmits<{
  'toggle-visibility': []
  'set-particle-count': [value: number]
  'set-speed-factor': [value: number]
  'set-fade-opacity': [value: number]
  'set-line-width': [value: number]
  'set-height-scale': [value: number]
  'set-color-scale': [name: Wind3DColorScaleName]
  'toggle-level': [index: number]
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
    key: 'altitude' as const,
    label: '高度',
    gradient: 'linear-gradient(90deg, #32c832, #32c8c8, #3264ff, #b432ff, #ff3264)',
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

function formatAlt(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(0)}km`
  return `${meters}m`
}
</script>

<style scoped lang="scss">
.wind3d-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(20, 25, 40, 0.92);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  min-width: 240px;
  max-width: 280px;
  max-height: calc(100vh - 60px);
  overflow-y: auto;
  z-index: 10;
  color: #e0e0e0;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    padding-bottom: 10px;
    color: #fff;
  }
}

.control-row {
  margin-bottom: 14px;

  label {
    display: block;
    font-size: 13px;
    color: #aaa;
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
  gap: 6px;
}

.color-scale-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  font-size: 11px;
  color: #ccc;
  transition: all 0.2s;

  &.active {
    border-color: #409eff;
    background: rgba(64, 158, 255, 0.15);
    color: #fff;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
}

.color-preview {
  width: 100%;
  height: 8px;
  border-radius: 4px;
}

.level-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.level-toggle {
  display: flex !important;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;

  input[type='checkbox'] {
    width: 14px;
    height: 14px;
    accent-color: #409eff;
  }
}

.legend {
  margin-bottom: 14px;

  label {
    display: block;
    font-size: 13px;
    color: #aaa;
    margin-bottom: 6px;
  }
}

.legend-bar {
  height: 10px;
  border-radius: 5px;
  margin-bottom: 4px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #888;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.2);
  color: #409eff;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;

  &:hover {
    background: rgba(64, 158, 255, 0.35);
  }
}
</style>
