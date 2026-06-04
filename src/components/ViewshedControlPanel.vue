<template>
  <div class="viewshed-control-panel">
    <h3>👁️ 可视域分析</h3>

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

    <!-- 图层开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>显示分析结果</span>
        <input type="checkbox" :checked="isVisible" @change="$emit('toggle-visibility')" />
      </label>
    </div>

    <!-- 视锥开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>显示视锥轮廓</span>
        <input type="checkbox" :checked="showFrustum" @change="$emit('toggle-frustum')" />
      </label>
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

    <!-- 可见区域颜色 -->
    <div class="control-row">
      <label>可见区域颜色</label>
      <div class="color-options">
        <button
          class="color-btn"
          :class="{ active: visibleColor === 'green' }"
          @click="$emit('set-visible-color', 'green')"
        >
          <span class="color-dot" style="background: #00ff00"></span>
          绿色
        </button>
        <button
          class="color-btn"
          :class="{ active: visibleColor === 'blue' }"
          @click="$emit('set-visible-color', 'blue')"
        >
          <span class="color-dot" style="background: #00bfff"></span>
          蓝色
        </button>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend">
      <label>图例</label>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" :style="{ background: visibleColor === 'green' ? '#00ff00' : '#00bfff' }"></span>
          <span>可见区域</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ff0000"></span>
          <span>不可见区域</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #ffff00"></span>
          <span>观察点</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #00ffff"></span>
          <span>视锥范围</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: #556677"></span>
          <span>遮挡物（建筑/山丘）</span>
        </div>
      </div>
    </div>

    <!-- 分析统计 -->
    <div class="statistics" v-if="result">
      <label>分析统计</label>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-value">{{ result.visibleCount }}</span>
          <span class="stat-label">可见点</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ result.totalCount - result.visibleCount }}</span>
          <span class="stat-label">遮挡点</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ visiblePercent }}%</span>
          <span class="stat-label">可视率</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ result.params.radius }}m</span>
          <span class="stat-label">分析半径</span>
        </div>
      </div>
      <div class="stat-bar">
        <div class="stat-bar-fill" :style="{ width: visiblePercent + '%' }"></div>
      </div>
    </div>

    <!-- 观察参数 -->
    <div class="observer-info" v-if="result">
      <label>观察点参数</label>
      <div class="info-grid">
        <div>高度：{{ result.params.height }}m</div>
        <div>方位：{{ result.params.heading }}°</div>
        <div>俯仰：{{ result.params.pitch }}°</div>
        <div>水平FOV：{{ result.params.fovH }}°</div>
      </div>
    </div>

    <!-- 功能按钮 -->
    <div class="control-row actions">
      <button class="action-btn" @click="$emit('fly-to')">📍 定位观察点</button>
      <button class="action-btn" @click="$emit('re-analyze')">🔄 重新分析</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VIEWSHED_PRESETS, type ViewshedResult } from '@/data/viewshedData'

const props = defineProps<{
  isVisible: boolean
  showFrustum: boolean
  opacity: number
  visibleColor: 'green' | 'blue'
  currentPreset: number
  result: ViewshedResult | null
}>()

defineEmits<{
  'toggle-visibility': []
  'toggle-frustum': []
  'set-opacity': [value: number]
  'set-visible-color': [color: 'green' | 'blue']
  'switch-preset': [index: number]
  'fly-to': []
  're-analyze': []
}>()

const presets = VIEWSHED_PRESETS

const visiblePercent = computed(() => {
  if (!props.result || props.result.totalCount === 0) return 0
  return Math.round((props.result.visibleCount / props.result.totalCount) * 100)
})
</script>

<style scoped lang="scss">
.viewshed-control-panel {
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
  flex-direction: column;
  gap: 6px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #999;
  }

  &.active {
    border-color: #1976d2;
    background: #e3f2fd;
  }
}

.preset-name {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.preset-desc {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.color-options {
  display: flex;
  gap: 8px;
}

.color-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    border-color: #999;
  }

  &.active {
    border-color: #1976d2;
    background: #e3f2fd;
  }
}

.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.legend {
  margin-bottom: 14px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 8px;
    color: #555;
    font-size: 13px;
    font-weight: 500;
  }
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #555;
}

.legend-color {
  display: inline-block;
  width: 16px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.statistics {
  margin-bottom: 14px;
  padding: 10px;
  background: #f0f7ff;
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 8px;
    color: #1565c0;
    font-weight: 500;
    font-size: 13px;
  }
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}

.stat-item {
  text-align: center;

  .stat-value {
    display: block;
    font-size: 18px;
    font-weight: bold;
    color: #1976d2;
  }

  .stat-label {
    font-size: 11px;
    color: #888;
  }
}

.stat-bar {
  height: 8px;
  background: #ffcdd2;
  border-radius: 4px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #81c784);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.observer-info {
  margin-bottom: 14px;
  padding: 10px;
  background: #fff8e1;
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #f57f17;
    font-weight: 500;
    font-size: 13px;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  font-size: 12px;
  color: #555;
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }

  &:active {
    transform: scale(0.97);
  }
}
</style>
