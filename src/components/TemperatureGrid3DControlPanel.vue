<template>
  <div class="temp3d-control-panel">
    <h3>🌡️ 三维温度格点控制</h3>

    <!-- 图层开关 -->
    <div class="control-row">
      <label class="switch-label">
        <span>显示图层</span>
        <input type="checkbox" :checked="isVisible" @change="$emit('toggle-visibility')" />
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

    <!-- 高度夸张 -->
    <div class="control-row">
      <label>高度夸张：{{ heightScale }}x</label>
      <input
        type="range"
        min="1"
        max="200"
        step="1"
        :value="heightScale"
        @input="$emit('set-height-scale', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 色标方案 -->
    <div class="control-row">
      <label>色标方案</label>
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

    <!-- 图例 -->
    <div class="legend" v-if="gridData">
      <label>温度图例 (℃)</label>
      <div class="legend-bar" :style="{ background: currentGradient }"></div>
      <div class="legend-labels">
        <span>{{ gridData.minTemp.toFixed(1) }}</span>
        <span>{{ ((gridData.minTemp + gridData.maxTemp) / 2).toFixed(1) }}</span>
        <span>{{ gridData.maxTemp.toFixed(1) }}</span>
      </div>
    </div>

    <!-- 温度查询结果 -->
    <div class="query-result" v-if="queryResult !== null">
      <label>当前查询</label>
      <div class="query-info">
        <div>经度：{{ queryResult.lon.toFixed(4) }}°</div>
        <div>纬度：{{ queryResult.lat.toFixed(4) }}°</div>
        <div class="temp-value">温度：<strong>{{ queryResult.temp.toFixed(1) }}℃</strong></div>
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
import type { TemperatureGrid3DData, Temp3DColorScaleName } from '@/data/temperatureGrid3D'

const props = defineProps<{
  isVisible: boolean
  opacity: number
  heightScale: number
  colorScale: Temp3DColorScaleName
  gridData: TemperatureGrid3DData | null
  queryResult: { lon: number; lat: number; temp: number } | null
}>()

defineEmits<{
  'toggle-visibility': []
  'set-opacity': [value: number]
  'set-height-scale': [value: number]
  'set-color-scale': [name: Temp3DColorScaleName]
  'fly-to': []
  'reload': []
}>()

const colorScales = [
  {
    key: 'classic' as const,
    label: '经典',
    gradient: 'linear-gradient(90deg, #000080, #00b4ff, #00ff80, #ffff00, #ff8000, #ff0000)',
  },
  {
    key: 'heat' as const,
    label: '热力',
    gradient: 'linear-gradient(90deg, #000000, #500078, #b4003c, #ff5000, #ffdc00, #ffffff)',
  },
  {
    key: 'diverging' as const,
    label: '冷暖',
    gradient: 'linear-gradient(90deg, #0000b4, #508cff, #c8dcff, #f5f5f5, #ffdcc8, #ff643c, #b40000)',
  },
]

const currentGradient = computed(() => {
  return colorScales.find((s) => s.key === props.colorScale)?.gradient ?? colorScales[0]!.gradient
})
</script>

<style scoped lang="scss">
.temp3d-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 240px;
  max-width: 280px;
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

.color-preview {
  display: inline-block;
  width: 60px;
  height: 14px;
  border-radius: 3px;
}

.legend {
  margin-bottom: 14px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #555;
    font-size: 13px;
  }
}

.legend-bar {
  height: 16px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #888;
}

.query-result {
  margin-bottom: 14px;
  padding: 10px;
  background: #e8f5e9;
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #2e7d32;
    font-weight: 500;
    font-size: 13px;
  }
}

.query-info {
  font-size: 13px;
  color: #333;
  line-height: 1.6;

  .temp-value {
    color: #d32f2f;

    strong {
      font-size: 16px;
    }
  }
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
    background: #f0f0f0;
    border-color: #aaa;
  }
}
</style>
