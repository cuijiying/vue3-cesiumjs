<template>
  <div class="lat-control-panel">
    <h3>🛰️ 低空气象数字孪生 · AI飞行决策</h3>

    <!-- 气象情景 -->
    <div class="control-row">
      <label>气象情景</label>
      <div class="scenario-options">
        <button
          v-for="sc in scenarios"
          :key="sc.key"
          class="scenario-btn"
          :class="{ active: scenario === sc.key }"
          @click="$emit('switch-scenario', sc.key)"
        >
          <span class="scenario-name">{{ sc.name }}</span>
          <span class="scenario-desc">{{ sc.description }}</span>
        </button>
      </div>
    </div>

    <!-- 实时气象 -->
    <div class="status-panel">
      <label>实时气象</label>
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-value">{{ windSpeed }}</span>
          <span class="stat-label">风速 m/s</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ windDirection }}°</span>
          <span class="stat-label">风向</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ visibilityText }}</span>
          <span class="stat-label">能见度</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ corridorAltitude }}m</span>
          <span class="stat-label">巡航高度</span>
        </div>
      </div>
    </div>

    <!-- AI 飞行决策 -->
    <div class="ai-panel" :class="decisionClass">
      <div class="ai-header">
        <span>🧠 AI 飞行决策</span>
        <button class="analyze-btn" :disabled="analyzing" @click="$emit('run-analysis')">
          {{ analyzing ? '分析中…' : '重新评估' }}
        </button>
      </div>

      <div v-if="decision" class="ai-body">
        <div class="decision-badge" :class="decisionClass">
          <span class="badge-label">{{ decision.overall }}</span>
          <span class="badge-risk">综合风险 {{ decision.overallRisk }}</span>
        </div>
        <p class="ai-summary">{{ decision.summary }}</p>

        <!-- 分段风险 -->
        <div class="seg-list">
          <div v-for="seg in decision.segments" :key="seg.index" class="seg-item">
            <span class="seg-dot" :style="{ background: levelColor(seg.level) }"></span>
            <span class="seg-name">{{ seg.fromName }} → {{ seg.toName }}</span>
            <span class="seg-risk" :style="{ color: levelColor(seg.level) }">{{ seg.risk }}</span>
          </div>
        </div>

        <!-- 建议 -->
        <div class="rec-list">
          <div v-for="(rec, i) in decision.recommendations" :key="i" class="rec-item">
            • {{ rec }}
          </div>
        </div>

        <button
          v-if="decision.suggestedAltitude > corridorAltitude"
          class="adopt-btn"
          @click="$emit('adopt-altitude')"
        >
          ⬆ 采用建议高度 {{ decision.suggestedAltitude }}m
        </button>
      </div>
    </div>

    <!-- 巡航高度 -->
    <div class="control-row">
      <label>巡航高度：{{ corridorAltitude }}m</label>
      <input
        type="range"
        min="40"
        max="400"
        step="10"
        :value="corridorAltitude"
        @input="$emit('set-altitude', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- 无人机飞行 -->
    <div class="control-row">
      <label class="switch-label">
        <span>无人机巡航</span>
        <button class="toggle-btn" :class="{ active: droneFlying }" @click="$emit('toggle-drone-flight')">
          {{ droneFlying ? '⏸ 暂停' : '▶ 起飞' }}
        </button>
      </label>
    </div>
    <div class="control-row">
      <label>航迹进度：{{ Math.round(droneProgress * 100) }}%</label>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="Math.round(droneProgress * 100)"
        @input="$emit('set-progress', Number(($event.target as HTMLInputElement).value) / 100)"
      />
    </div>

    <!-- XR 可视化 -->
    <div class="control-row xr-row">
      <button class="xr-btn" :class="{ active: xrMode }" @click="$emit('toggle-xr')">
        🥽 XR 立体{{ xrMode ? '·开' : '·关' }}
      </button>
      <button class="xr-btn" :class="{ active: followDrone }" @click="$emit('toggle-follow')">
        🎯 第一视角{{ followDrone ? '·开' : '·关' }}
      </button>
    </div>

    <!-- 图层开关 -->
    <div class="layer-panel">
      <label>图层显隐</label>
      <div class="layer-grid">
        <label class="chk"><input type="checkbox" :checked="showBuildings" @change="$emit('toggle-layer', 'buildings')" /> 数字孪生</label>
        <label class="chk"><input type="checkbox" :checked="showWind" @change="$emit('toggle-layer', 'wind')" /> 风场</label>
        <label class="chk"><input type="checkbox" :checked="showRain" @change="$emit('toggle-layer', 'rain')" /> 降水</label>
        <label class="chk"><input type="checkbox" :checked="showFog" @change="$emit('toggle-layer', 'fog')" /> 低云雾</label>
        <label class="chk"><input type="checkbox" :checked="showTurbulence" @change="$emit('toggle-layer', 'turbulence')" /> 湍流</label>
        <label class="chk"><input type="checkbox" :checked="showCorridor" @change="$emit('toggle-layer', 'corridor')" /> 飞行走廊</label>
        <label class="chk"><input type="checkbox" :checked="showDrone" @change="$emit('toggle-layer', 'drone')" /> 无人机</label>
      </div>
    </div>

    <div class="control-row actions">
      <button class="action-btn" @click="$emit('fly-to')">📍 复位视角</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  WEATHER_SCENARIOS,
  riskColor,
  type WeatherScenarioKey,
  type AIDecision,
  type RiskLevel,
} from '@/data/lowAltitudeTwin'

const props = defineProps<{
  scenario: WeatherScenarioKey
  windSpeed: number
  windDirection: number
  visibility: number
  corridorAltitude: number
  droneFlying: boolean
  droneProgress: number
  xrMode: boolean
  followDrone: boolean
  showBuildings: boolean
  showWind: boolean
  showRain: boolean
  showFog: boolean
  showTurbulence: boolean
  showCorridor: boolean
  showDrone: boolean
  analyzing: boolean
  decision: AIDecision | null
}>()

defineEmits<{
  'switch-scenario': [key: WeatherScenarioKey]
  'set-altitude': [value: number]
  'toggle-drone-flight': []
  'set-progress': [value: number]
  'toggle-xr': []
  'toggle-follow': []
  'toggle-layer': [layer: 'buildings' | 'wind' | 'rain' | 'fog' | 'turbulence' | 'corridor' | 'drone']
  'run-analysis': []
  'adopt-altitude': []
  'fly-to': []
}>()

const scenarios = Object.values(WEATHER_SCENARIOS)

const visibilityText = computed(() =>
  props.visibility >= 1000 ? (props.visibility / 1000).toFixed(1) + 'km' : props.visibility + 'm',
)

const decisionClass = computed(() => {
  if (!props.decision) return ''
  return {
    GO: 'go',
    CAUTION: 'caution',
    'NO-GO': 'nogo',
  }[props.decision.overall]
})

function levelColor(level: RiskLevel) {
  return riskColor(level)
}
</script>

<style scoped lang="scss">
.lat-control-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(10, 16, 32, 0.92);
  border: 1px solid rgba(90, 209, 255, 0.3);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), inset 0 0 30px rgba(90, 209, 255, 0.03);
  min-width: 290px;
  max-width: 320px;
  z-index: 100;
  font-size: 14px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  color: #d4e6f5;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(90, 209, 255, 0.3);
    border-radius: 2px;
  }

  h3 {
    margin: 0 0 16px;
    font-size: 15px;
    color: #5ad1ff;
    text-shadow: 0 0 8px rgba(90, 209, 255, 0.3);
  }
}

.control-row {
  margin-bottom: 12px;

  label {
    display: block;
    margin-bottom: 6px;
    color: #9bc4dd;
    font-size: 13px;
  }

  input[type='range'] {
    width: 100%;
    cursor: pointer;
    accent-color: #2bb8ee;
  }
}

.scenario-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.scenario-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 7px 9px;
  border: 1px solid rgba(90, 209, 255, 0.2);
  border-radius: 8px;
  background: rgba(90, 209, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;

  &:hover {
    border-color: rgba(90, 209, 255, 0.45);
    background: rgba(90, 209, 255, 0.1);
  }

  &.active {
    border-color: #5ad1ff;
    background: rgba(90, 209, 255, 0.16);
    box-shadow: 0 0 8px rgba(90, 209, 255, 0.2);
  }

  .scenario-name {
    font-weight: 600;
    font-size: 13px;
    color: #d4eeff;
  }

  .scenario-desc {
    font-size: 10px;
    color: #7fa6bd;
    margin-top: 2px;
    line-height: 1.3;
  }
}

.status-panel {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(90, 209, 255, 0.03);
  border: 1px solid rgba(90, 209, 255, 0.15);
  border-radius: 8px;

  label {
    display: block;
    margin-bottom: 8px;
    color: #9bc4dd;
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
  background: rgba(90, 209, 255, 0.05);
  border-radius: 6px;

  .stat-value {
    display: block;
    font-size: 15px;
    font-weight: bold;
    color: #5ad1ff;
    font-family: 'Courier New', monospace;
  }

  .stat-label {
    display: block;
    font-size: 11px;
    color: #6f93a9;
    margin-top: 2px;
  }
}

/* AI 面板 */
.ai-panel {
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(20, 28, 48, 0.6);
  border: 1px solid rgba(90, 209, 255, 0.2);
  transition: border-color 0.3s;

  &.go {
    border-color: rgba(0, 230, 118, 0.5);
  }
  &.caution {
    border-color: rgba(255, 179, 0, 0.5);
  }
  &.nogo {
    border-color: rgba(255, 61, 87, 0.55);
  }
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
  color: #cfe8f7;
  font-size: 13px;
}

.analyze-btn {
  padding: 4px 10px;
  border: 1px solid rgba(90, 209, 255, 0.4);
  border-radius: 6px;
  background: rgba(90, 209, 255, 0.12);
  color: #5ad1ff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(90, 209, 255, 0.22);
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.decision-badge {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;

  .badge-label {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 1px;
  }
  .badge-risk {
    font-size: 12px;
    opacity: 0.85;
  }

  &.go {
    background: rgba(0, 230, 118, 0.15);
    color: #00e676;
  }
  &.caution {
    background: rgba(255, 179, 0, 0.15);
    color: #ffb300;
  }
  &.nogo {
    background: rgba(255, 61, 87, 0.16);
    color: #ff3d57;
  }
}

.ai-summary {
  margin: 0 0 10px;
  font-size: 12px;
  color: #b9d4e6;
  line-height: 1.5;
}

.seg-list {
  margin-bottom: 10px;
}

.seg-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 11px;
  color: #aac6d8;

  .seg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .seg-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .seg-risk {
    font-family: 'Courier New', monospace;
    font-weight: bold;
  }
}

.rec-list {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 10px;
}

.rec-item {
  font-size: 11px;
  color: #c5dcea;
  line-height: 1.6;
}

.adopt-btn {
  width: 100%;
  padding: 7px;
  border: 1px solid rgba(0, 230, 118, 0.5);
  border-radius: 7px;
  background: rgba(0, 230, 118, 0.12);
  color: #00e676;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 230, 118, 0.22);
  }
}

.switch-label {
  display: flex !important;
  align-items: center;
  justify-content: space-between;

  span {
    color: #c0d8e8;
    font-weight: 500;
  }
}

.toggle-btn {
  padding: 4px 12px;
  border: 1px solid rgba(90, 209, 255, 0.4);
  border-radius: 6px;
  background: rgba(90, 209, 255, 0.1);
  color: #5ad1ff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &.active {
    background: rgba(90, 209, 255, 0.22);
    border-color: #5ad1ff;
  }
  &:hover {
    background: rgba(90, 209, 255, 0.25);
  }
}

.xr-row {
  display: flex;
  gap: 8px;
}

.xr-btn {
  flex: 1;
  padding: 8px 6px;
  border: 1px solid rgba(168, 120, 255, 0.4);
  border-radius: 8px;
  background: rgba(168, 120, 255, 0.1);
  color: #c8a9ff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;

  &.active {
    background: rgba(168, 120, 255, 0.28);
    border-color: #c8a9ff;
    box-shadow: 0 0 8px rgba(168, 120, 255, 0.25);
  }
  &:hover {
    background: rgba(168, 120, 255, 0.2);
  }
}

.layer-panel {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(90, 209, 255, 0.03);
  border: 1px solid rgba(90, 209, 255, 0.15);
  border-radius: 8px;

  > label {
    display: block;
    margin-bottom: 8px;
    color: #9bc4dd;
    font-size: 13px;
  }
}

.layer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}

.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #bcd4e4;
  cursor: pointer;

  input[type='checkbox'] {
    width: 15px;
    height: 15px;
    cursor: pointer;
    accent-color: #2bb8ee;
  }
}

.actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(90, 209, 255, 0.3);
  border-radius: 8px;
  background: rgba(90, 209, 255, 0.1);
  color: #5ad1ff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;

  &:hover {
    background: rgba(90, 209, 255, 0.2);
    border-color: #5ad1ff;
  }
}
</style>
