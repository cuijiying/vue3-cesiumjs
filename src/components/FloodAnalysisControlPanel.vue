<template>
  <div class="flood-control-panel">
    <h3>🌊 淹没分析控制</h3>

    <!-- 场景预设 -->
    <div class="control-row">
      <label>场景预设</label>
      <div class="preset-options">
        <button
          v-for="(preset, idx) in presets"
          :key="idx"
          class="preset-btn"
          :class="{ active: currentPreset === idx }"
          @click="$emit('load-preset', idx)"
        >
          {{ preset.name }}
        </button>
      </div>
      <div class="preset-desc" v-if="presets[currentPreset]">
        {{ presets[currentPreset]!.description }}
      </div>
    </div>

    <!-- 图层开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>显示图层</span>
        <input type="checkbox" :checked="isVisible" @change="$emit('toggle-visibility')" />
      </label>
    </div>

    <!-- 地形开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>显示地形</span>
        <input type="checkbox" :checked="showTerrain" @change="$emit('toggle-terrain')" />
      </label>
    </div>

    <!-- 水位高度 -->
    <div class="control-row">
      <label>水位高度：{{ waterLevel.toFixed(1) }} m</label>
      <input
        type="range"
        :min="minElev"
        :max="maxElev"
        step="0.5"
        :value="waterLevel"
        :disabled="isAnimating"
        @input="$emit('set-water-level', Number(($event.target as HTMLInputElement).value))"
      />
      <div class="range-labels">
        <span>{{ minElev.toFixed(0) }}m</span>
        <span>{{ maxElev.toFixed(0) }}m</span>
      </div>
    </div>

    <!-- 水面透明度 -->
    <div class="control-row">
      <label>水面透明度：{{ Math.round(waterOpacity * 100) }}%</label>
      <input
        type="range"
        min="10"
        max="100"
        step="5"
        :value="Math.round(waterOpacity * 100)"
        @input="$emit('set-water-opacity', Number(($event.target as HTMLInputElement).value) / 100)"
      />
    </div>

    <!-- 水面颜色 -->
    <div class="control-row">
      <label>水面颜色</label>
      <div class="color-options">
        <button
          v-for="(color, key) in waterColors"
          :key="key"
          class="color-btn"
          :class="{ active: waterColor === key }"
          @click="$emit('set-water-color', key)"
        >
          <span
            class="color-swatch"
            :style="{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }"
          ></span>
          <span>{{ color.label }}</span>
        </button>
      </div>
    </div>

    <!-- 淹没统计 -->
    <div class="stats-section" v-if="floodStats">
      <label>淹没统计</label>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">淹没比例</span>
          <span class="stat-value">{{ (floodStats.floodedRatio * 100).toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">淹没面积</span>
          <span class="stat-value">{{ floodStats.floodedArea }} km²</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">最大水深</span>
          <span class="stat-value">{{ floodStats.maxDepth }} m</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平均水深</span>
          <span class="stat-value">{{ floodStats.avgDepth }} m</span>
        </div>
      </div>
      <!-- 淹没进度条 -->
      <div class="flood-bar">
        <div
          class="flood-bar-fill"
          :style="{ width: (floodStats.floodedRatio * 100) + '%' }"
        ></div>
      </div>
    </div>

    <!-- 功能按钮 -->
    <div class="control-row actions">
      <button
        class="action-btn"
        :class="{ 'btn-danger': isAnimating }"
        @click="isAnimating ? $emit('stop-animation') : $emit('start-animation')"
      >
        {{ isAnimating ? '⏹ 停止' : '▶ 水位上涨' }}
      </button>
      <button class="action-btn" @click="$emit('fly-to')">📍 定位图层</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FLOOD_PRESETS, WATER_COLORS, type WaterColorName } from '@/data/floodData'

const props = defineProps<{
  isVisible: boolean
  waterLevel: number
  waterOpacity: number
  waterColor: WaterColorName
  currentPreset: number
  floodStats: {
    floodedRatio: number
    floodedArea: number
    totalArea: number
    maxDepth: number
    avgDepth: number
    floodedCount: number
    totalCount: number
  } | null
  isAnimating: boolean
  showTerrain: boolean
  minElev: number
  maxElev: number
}>()

defineEmits<{
  'toggle-visibility': []
  'toggle-terrain': []
  'set-water-level': [value: number]
  'set-water-opacity': [value: number]
  'set-water-color': [name: WaterColorName]
  'load-preset': [index: number]
  'start-animation': []
  'stop-animation': []
  'fly-to': []
}>()

const presets = FLOOD_PRESETS
const waterColors = WATER_COLORS
</script>

<style scoped lang="scss">
.flood-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 260px;
  max-width: 300px;
  z-index: 100;
  font-size: 14px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    color: #333;
  }
}

.control-row {
  margin-bottom: 14px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #555;
    font-size: 13px;
  }

  input[type='range'] {
    width: 100%;
    cursor: pointer;
  }
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.switch-label {
  display: flex !important;
  align-items: center;
  justify-content: space-between;

  span {
    color: #333;
    font-weight: 500;
  }

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
}

.preset-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-btn {
  padding: 4px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #f8f8f8;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: #1890ff;
    color: #1890ff;
  }

  &.active {
    background: #1890ff;
    color: #fff;
    border-color: #1890ff;
  }
}

.preset-desc {
  margin-top: 6px;
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.color-options {
  display: flex;
  gap: 6px;
}

.color-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #f8f8f8;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    border-color: #1890ff;
  }

  &.active {
    border-color: #1890ff;
    background: #e6f7ff;
  }
}

.color-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.stats-section {
  margin-bottom: 14px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;

  > label {
    display: block;
    margin-bottom: 8px;
    color: #333;
    font-weight: 500;
    font-size: 13px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;

  .stat-label {
    font-size: 11px;
    color: #999;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #1890ff;
  }
}

.flood-bar {
  margin-top: 8px;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
}

.flood-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #ff4d4f);
  border-radius: 3px;
  transition: width 0.3s;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #1890ff;
  border-radius: 8px;
  background: #fff;
  color: #1890ff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    background: #1890ff;
    color: #fff;
  }

  &.btn-danger {
    border-color: #ff4d4f;
    color: #ff4d4f;

    &:hover {
      background: #ff4d4f;
      color: #fff;
    }
  }
}
</style>
