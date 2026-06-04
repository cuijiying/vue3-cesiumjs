<template>
  <div class="ai-control-panel">
    <h3>🤖 AI 智能目标检测</h3>

    <!-- 分析区域选择 -->
    <div class="control-section">
      <label>分析区域</label>
      <div class="region-options">
        <button
          v-for="region in regions"
          :key="region.name"
          class="region-btn"
          :class="{ active: selectedRegion.name === region.name }"
          @click="$emit('set-region', region)"
          :disabled="isAnalyzing"
        >
          {{ region.name }}
        </button>
      </div>
      <p class="hint">{{ selectedRegion.description }}</p>
    </div>

    <!-- AI 模型选择 -->
    <div class="control-section">
      <label>AI 模型</label>
      <select
        :value="selectedModel.name"
        @change="onModelChange(($event.target as HTMLSelectElement).value)"
        :disabled="isAnalyzing"
      >
        <option v-for="model in models" :key="model.name" :value="model.name">
          {{ model.name }}
        </option>
      </select>
      <p class="hint">{{ selectedModel.description }}</p>
    </div>

    <!-- 运行分析 -->
    <div class="control-section">
      <button
        class="analyze-btn"
        :class="{ analyzing: isAnalyzing }"
        @click="$emit('run-analysis')"
        :disabled="isAnalyzing"
      >
        <span v-if="!isAnalyzing">🔍 运行 AI 分析</span>
        <span v-else>
          <span class="spinner"></span>
          分析中... {{ analysisProgress }}%
        </span>
      </button>
      <div class="progress-bar" v-if="isAnalyzing">
        <div class="progress-fill" :style="{ width: analysisProgress + '%' }"></div>
      </div>
    </div>

    <!-- 检测结果统计 -->
    <div class="control-section results" v-if="stats">
      <label>检测结果</label>
      <div class="stats-grid">
        <div class="stat-item total">
          <span class="stat-num">{{ stats.total }}</span>
          <span class="stat-label">目标总数</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ (stats.avgConfidence * 100).toFixed(0) }}%</span>
          <span class="stat-label">平均置信度</span>
        </div>
        <div class="stat-item" v-for="(count, sev) in stats.bySeverity" :key="sev">
          <span class="stat-num" :style="{ color: severityInfo[Number(sev)]?.color }">{{ count }}</span>
          <span class="stat-label">{{ severityInfo[Number(sev)]?.label }}风险</span>
        </div>
      </div>

      <!-- 分类分布 -->
      <div class="category-stats">
        <div
          v-for="(count, cat) in stats.byCategory"
          :key="cat"
          class="cat-bar"
        >
          <span class="cat-icon">{{ categoryInfo[cat]?.icon }}</span>
          <span class="cat-name">{{ categoryInfo[cat]?.label }}</span>
          <div class="cat-bar-bg">
            <div
              class="cat-bar-fill"
              :style="{
                width: (count / stats.total) * 100 + '%',
                background: categoryInfo[cat]?.color,
              }"
            ></div>
          </div>
          <span class="cat-count">{{ count }}</span>
        </div>
      </div>
    </div>

    <!-- 过滤控制 -->
    <div class="control-section" v-if="stats">
      <label>过滤条件</label>

      <!-- 置信度阈值 -->
      <div class="filter-row">
        <span>置信度 ≥ {{ Math.round(confidenceThreshold * 100) }}%</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(confidenceThreshold * 100)"
          @input="$emit('set-confidence', Number(($event.target as HTMLInputElement).value) / 100)"
        />
      </div>

      <!-- 类别筛选 -->
      <div class="category-filters">
        <label
          v-for="(info, cat) in categoryInfo"
          :key="cat"
          class="cat-filter"
          :class="{ active: selectedCategories.has(cat as any) }"
        >
          <input
            type="checkbox"
            :checked="selectedCategories.has(cat as any)"
            @change="$emit('toggle-category', cat)"
          />
          <span class="cat-chip" :style="{ borderColor: info.color }">
            {{ info.icon }} {{ info.label }}
          </span>
        </label>
      </div>
    </div>

    <!-- 热力图 & 工具 -->
    <div class="control-section actions" v-if="stats">
      <button
        class="tool-btn"
        :class="{ active: showHeatmap }"
        @click="$emit('toggle-heatmap')"
      >
        🔥 {{ showHeatmap ? '关闭热力图' : '显示热力图' }}
      </button>
      <button class="tool-btn" @click="$emit('clear')">🗑️ 清除结果</button>
    </div>

    <!-- 目标详情 -->
    <div class="control-section target-detail" v-if="selectedTarget">
      <label>目标详情</label>
      <div class="detail-card">
        <div class="detail-header" :style="{ borderColor: categoryInfo[selectedTarget.category]?.color }">
          <span class="detail-icon">{{ categoryInfo[selectedTarget.category]?.icon }}</span>
          <span class="detail-cat">{{ categoryInfo[selectedTarget.category]?.label }}</span>
          <span
            class="detail-severity"
            :style="{ background: severityInfo[selectedTarget.severity]?.color }"
          >
            {{ severityInfo[selectedTarget.severity]?.label }}风险
          </span>
        </div>
        <div class="detail-body">
          <p>{{ selectedTarget.description }}</p>
          <div class="detail-meta">
            <span>置信度: {{ (selectedTarget.confidence * 100).toFixed(0) }}%</span>
            <span>经度: {{ selectedTarget.lon.toFixed(4) }}°</span>
            <span>纬度: {{ selectedTarget.lat.toFixed(4) }}°</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 目标列表 -->
    <div class="control-section target-list" v-if="filteredTargets.length > 0">
      <label>目标列表 ({{ filteredTargets.length }})</label>
      <ul class="targets">
        <li
          v-for="t in filteredTargets.slice(0, 20)"
          :key="t.id"
          class="target-item"
          :class="{ selected: selectedTarget?.id === t.id }"
          @click="$emit('select-target', t)"
        >
          <span class="t-icon">{{ categoryInfo[t.category]?.icon }}</span>
          <span class="t-desc">{{ t.description }}</span>
          <span
            class="t-conf"
            :style="{ color: t.confidence > 0.8 ? '#F44336' : t.confidence > 0.6 ? '#FF9800' : '#999' }"
          >
            {{ (t.confidence * 100).toFixed(0) }}%
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CATEGORY_INFO,
  SEVERITY_INFO,
  AI_MODELS,
  ANALYSIS_REGIONS,
  type DetectionTarget,
  type DetectionStats,
  type TargetCategory,
  type AIModelConfig,
  type AnalysisRegion,
} from '@/data/aiDetection'

const props = defineProps<{
  selectedRegion: AnalysisRegion
  selectedModel: AIModelConfig
  isAnalyzing: boolean
  analysisProgress: number
  stats: DetectionStats | null
  confidenceThreshold: number
  selectedCategories: Set<TargetCategory>
  selectedTarget: DetectionTarget | null
  filteredTargets: DetectionTarget[]
  showHeatmap: boolean
}>()

const emit = defineEmits<{
  'set-region': [region: AnalysisRegion]
  'set-model': [model: AIModelConfig]
  'run-analysis': []
  'set-confidence': [val: number]
  'toggle-category': [cat: TargetCategory]
  'toggle-heatmap': []
  'select-target': [target: DetectionTarget]
  'clear': []
}>()

const regions = ANALYSIS_REGIONS
const models = AI_MODELS
const categoryInfo = CATEGORY_INFO
const severityInfo = SEVERITY_INFO

function onModelChange(name: string) {
  const model = models.find((m) => m.name === name)
  if (model) emit('set-model', model)
}
</script>

<style scoped lang="scss">
.ai-control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  min-width: 280px;
  max-width: 320px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  color: #e2e8f0;
  font-size: 0.85rem;
  z-index: 100;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }

  h3 {
    margin: 0 0 14px;
    font-size: 1rem;
    color: #67e8f9;
    letter-spacing: 0.5px;
  }

  .control-section {
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    &:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    > label {
      display: block;
      font-size: 0.78rem;
      color: #94a3b8;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
  }

  .hint {
    font-size: 0.75rem;
    color: #64748b;
    margin: 4px 0 0;
  }

  // Region buttons
  .region-options {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .region-btn {
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid rgba(103, 232, 249, 0.3);
    background: transparent;
    color: #94a3b8;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(103, 232, 249, 0.1);
      color: #67e8f9;
    }

    &.active {
      background: rgba(103, 232, 249, 0.2);
      border-color: #67e8f9;
      color: #67e8f9;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  // Select
  select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: #e2e8f0;
    font-size: 0.82rem;

    &:disabled {
      opacity: 0.4;
    }
  }

  // Analyze button
  .analyze-btn {
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #06b6d4, #3b82f6);
    color: white;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    &:disabled {
      cursor: not-allowed;
    }

    &.analyzing {
      background: linear-gradient(135deg, #0e7490, #1d4ed8);
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
  }

  .progress-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    margin-top: 8px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #06b6d4, #3b82f6);
      border-radius: 2px;
      transition: width 0.3s;
    }
  }

  // Stats
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px;
    text-align: center;

    &.total {
      grid-column: span 2;
      background: rgba(103, 232, 249, 0.1);
    }

    .stat-num {
      display: block;
      font-size: 1.2rem;
      font-weight: 700;
      color: #f1f5f9;
    }

    .stat-label {
      font-size: 0.7rem;
      color: #64748b;
    }
  }

  // Category bars
  .category-stats {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cat-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;

    .cat-icon {
      font-size: 0.9rem;
    }
    .cat-name {
      width: 55px;
      color: #94a3b8;
    }
    .cat-bar-bg {
      flex: 1;
      height: 6px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 3px;
      overflow: hidden;
    }
    .cat-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.5s;
    }
    .cat-count {
      width: 20px;
      text-align: right;
      color: #94a3b8;
    }
  }

  // Filters
  .filter-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;

    span {
      font-size: 0.78rem;
      color: #94a3b8;
    }

    input[type='range'] {
      width: 100%;
      accent-color: #06b6d4;
    }
  }

  .category-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cat-filter {
    cursor: pointer;

    input[type='checkbox'] {
      display: none;
    }

    .cat-chip {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 0.72rem;
      color: #64748b;
      transition: all 0.2s;
    }

    &.active .cat-chip {
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.08);
    }
  }

  // Tool buttons
  .actions {
    display: flex;
    gap: 8px;
  }

  .tool-btn {
    flex: 1;
    padding: 7px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
    }

    &.active {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
  }

  // Target detail
  .detail-card {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    overflow: hidden;
  }

  .detail-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-left: 3px solid;
    background: rgba(255, 255, 255, 0.03);

    .detail-icon {
      font-size: 1.1rem;
    }
    .detail-cat {
      flex: 1;
      font-weight: 600;
      color: #f1f5f9;
    }
    .detail-severity {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
      color: white;
    }
  }

  .detail-body {
    padding: 8px 10px;

    p {
      margin: 0 0 6px;
      color: #cbd5e1;
      font-size: 0.82rem;
    }

    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.72rem;
      color: #64748b;
    }
  }

  // Target list
  .target-list {
    .targets {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .target-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      &.selected {
        background: rgba(103, 232, 249, 0.1);
      }

      .t-icon {
        font-size: 0.9rem;
      }
      .t-desc {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.78rem;
        color: #cbd5e1;
      }
      .t-conf {
        font-size: 0.75rem;
        font-weight: 600;
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
