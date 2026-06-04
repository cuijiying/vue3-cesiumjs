<template>
  <div class="temp-control-panel">
    <h3>🌡️ 温度图层控制</h3>

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
        min="0"
        max="100"
        :value="Math.round(opacity * 100)"
        @input="$emit('set-opacity', Number(($event.target as HTMLInputElement).value) / 100)"
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

    <!-- 色值过滤 -->
    <div class="control-row filter-section" v-if="gridData">
      <label>色值过滤 (℃)</label>
      <div class="filter-inputs">
        <div class="filter-field">
          <span>最低</span>
          <input
            type="number"
            :value="displayFilterMin"
            :min="gridData.minTemp.toFixed(1)"
            :max="gridData.maxTemp.toFixed(1)"
            step="0.5"
            @change="onFilterMinChange(($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="filter-field">
          <span>最高</span>
          <input
            type="number"
            :value="displayFilterMax"
            :min="gridData.minTemp.toFixed(1)"
            :max="gridData.maxTemp.toFixed(1)"
            step="0.5"
            @change="onFilterMaxChange(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div class="filter-range-slider">
        <input
          type="range"
          :min="gridData.minTemp"
          :max="gridData.maxTemp"
          step="0.5"
          :value="displayFilterMin"
          @input="onFilterMinChange(($event.target as HTMLInputElement).value)"
        />
        <input
          type="range"
          :min="gridData.minTemp"
          :max="gridData.maxTemp"
          step="0.5"
          :value="displayFilterMax"
          @input="onFilterMaxChange(($event.target as HTMLInputElement).value)"
        />
      </div>
      <button class="reset-filter-btn" @click="$emit('reset-filter')">重置过滤</button>
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
import type { TemperatureGridData, ColorScaleName } from '@/data/temperatureGrid'

const props = defineProps<{
  isVisible: boolean
  opacity: number
  colorScale: ColorScaleName
  gridData: TemperatureGridData | null
  queryResult: { lon: number; lat: number; temp: number } | null
  filterMin: number
  filterMax: number
}>()

const emit = defineEmits<{
  'toggle-visibility': []
  'set-opacity': [value: number]
  'set-color-scale': [name: ColorScaleName]
  'set-filter': [min: number, max: number]
  'reset-filter': []
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
  return colorScales.find((s) => s.key === props.colorScale)?.gradient ?? ''
})

const displayFilterMin = computed(() => {
  if (!props.gridData) return 0
  return props.filterMin === -Infinity ? props.gridData.minTemp.toFixed(1) : props.filterMin.toFixed(1)
})

const displayFilterMax = computed(() => {
  if (!props.gridData) return 0
  return props.filterMax === Infinity ? props.gridData.maxTemp.toFixed(1) : props.filterMax.toFixed(1)
})

function onFilterMinChange(val: string) {
  const num = parseFloat(val)
  if (isNaN(num)) return
  const max = props.filterMax === Infinity && props.gridData ? props.gridData.maxTemp : props.filterMax
  emit('set-filter', num, max)
}

function onFilterMaxChange(val: string) {
  const num = parseFloat(val)
  if (isNaN(num)) return
  const min = props.filterMin === -Infinity && props.gridData ? props.gridData.minTemp : props.filterMin
  emit('set-filter', min, num)
}
</script>

<style scoped lang="scss">
.temp-control-panel {
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

  h3 {
    margin: 0 0 16px 0;
    font-size: 1rem;
    color: #333;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;
  }

  .control-row {
    margin-bottom: 14px;

    label {
      display: block;
      font-size: 0.85rem;
      color: #555;
      margin-bottom: 6px;
    }

    input[type='range'] {
      width: 100%;
      accent-color: #667eea;
    }
  }

  .switch-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;

    input[type='checkbox'] {
      accent-color: #667eea;
      width: 18px;
      height: 18px;
    }
  }

  .color-scale-options {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .color-scale-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: #667eea;
      }

      &.active {
        border-color: #667eea;
        background: #f0f3ff;
      }

      .color-preview {
        width: 60px;
        height: 14px;
        border-radius: 3px;
        flex-shrink: 0;
      }

      span:last-child {
        font-size: 0.8rem;
        color: #555;
      }
    }
  }

  .legend {
    margin-bottom: 14px;

    label {
      display: block;
      font-size: 0.85rem;
      color: #555;
      margin-bottom: 6px;
    }

    .legend-bar {
      height: 14px;
      border-radius: 3px;
      margin-bottom: 4px;
    }

    .legend-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #888;
    }
  }

  .query-result {
    margin-bottom: 14px;
    padding: 10px;
    background: #f8f9ff;
    border-radius: 8px;

    label {
      display: block;
      font-size: 0.85rem;
      color: #555;
      margin-bottom: 6px;
    }

    .query-info {
      font-size: 0.8rem;
      color: #444;
      line-height: 1.6;

      .temp-value {
        color: #d63031;
        strong {
          font-size: 1rem;
        }
      }
    }
  }

  .filter-section {
    .filter-inputs {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;

      .filter-field {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 4px;

        span {
          font-size: 0.75rem;
          color: #888;
          white-space: nowrap;
        }

        input[type='number'] {
          width: 100%;
          padding: 4px 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.8rem;
          text-align: center;

          &:focus {
            outline: none;
            border-color: #667eea;
          }
        }
      }
    }

    .filter-range-slider {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 6px;

      input[type='range'] {
        width: 100%;
        accent-color: #667eea;
        height: 16px;
      }
    }

    .reset-filter-btn {
      width: 100%;
      padding: 5px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 0.8rem;
      color: #667eea;
      transition: all 0.2s ease;

      &:hover {
        background: #667eea;
        color: white;
        border-color: #667eea;
      }
    }
  }

  .actions {
    display: flex;
    gap: 8px;

    .action-btn {
      flex: 1;
      padding: 8px 4px;
      border: 1px solid #ddd;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s ease;

      &:hover {
        background: #667eea;
        color: white;
        border-color: #667eea;
      }
    }
  }
}
</style>
