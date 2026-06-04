import { ref, shallowRef, computed, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import {
  simulateAIDetection,
  calcDetectionStats,
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

export function useAIDetection(viewer: Ref<Cesium.Viewer | null>) {
  // ===== 状态 =====
  const selectedRegion = ref<AnalysisRegion>(ANALYSIS_REGIONS[0]!)
  const selectedModel = ref<AIModelConfig>(AI_MODELS[0]!)
  const isAnalyzing = ref(false)
  const analysisProgress = ref(0)
  const targets = shallowRef<DetectionTarget[]>([])
  const stats = shallowRef<DetectionStats | null>(null)
  const confidenceThreshold = ref(0.5)
  const selectedCategories = ref<Set<TargetCategory>>(new Set(Object.keys(CATEGORY_INFO) as TargetCategory[]))
  const selectedTarget = ref<DetectionTarget | null>(null)
  const showHeatmap = ref(false)

  // Cesium 实体引用
  let targetEntities: Cesium.Entity[] = []
  let regionEntity: Cesium.Entity | null = null
  let heatmapEntity: Cesium.Entity | null = null
  let scanLineEntity: Cesium.Entity | null = null
  let scanAnimationId: number | null = null

  // ===== 过滤后的目标 =====
  const filteredTargets = computed(() => {
    return targets.value.filter(
      (t) => t.confidence >= confidenceThreshold.value && selectedCategories.value.has(t.category),
    )
  })

  // ===== 区域切换 =====
  function setRegion(region: AnalysisRegion) {
    selectedRegion.value = region
    clearResults()
    flyToRegion(region)
    drawRegionBoundary(region)
  }

  function setModel(model: AIModelConfig) {
    selectedModel.value = model
  }

  // ===== 飞到区域 =====
  function flyToRegion(region: AnalysisRegion) {
    if (!viewer.value) return
    viewer.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        region.center.lon,
        region.center.lat,
        region.cameraHeight,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60),
        roll: 0,
      },
      duration: 1.5,
    })
  }

  // ===== 绘制分析区域边界 =====
  function drawRegionBoundary(region: AnalysisRegion) {
    if (!viewer.value) return
    // 清除旧区域
    if (regionEntity) {
      viewer.value.entities.remove(regionEntity)
      regionEntity = null
    }
    regionEntity = viewer.value.entities.add({
      position: Cesium.Cartesian3.fromDegrees(region.center.lon, region.center.lat),
      ellipse: {
        semiMajorAxis: region.radius,
        semiMinorAxis: region.radius,
        material: Cesium.Color.CYAN.withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.6),
        outlineWidth: 2,
        height: 0,
      },
      label: {
        text: `分析区域: ${region.name}`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  // ===== AI 扫描动画 =====
  function startScanAnimation(region: AnalysisRegion): Promise<void> {
    return new Promise((resolve) => {
      if (!viewer.value) { resolve(); return }

      const v = viewer.value
      const startLat = region.center.lat + region.radius / 110540
      const endLat = region.center.lat - region.radius / 110540
      const lonSpan = region.radius / (111320 * Math.cos((region.center.lat * Math.PI) / 180))
      const west = region.center.lon - lonSpan
      const east = region.center.lon + lonSpan
      let currentLat = startLat
      const step = (startLat - endLat) / 60

      // 创建扫描线实体
      scanLineEntity = v.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            return Cesium.Cartesian3.fromDegreesArray([west, currentLat, east, currentLat])
          }, false),
          width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.3,
            color: Cesium.Color.LIME,
          }),
          clampToGround: true,
        },
      })

      const animate = () => {
        currentLat -= step
        analysisProgress.value = Math.min(
          90,
          Math.round(((startLat - currentLat) / (startLat - endLat)) * 90),
        )

        if (currentLat > endLat) {
          scanAnimationId = requestAnimationFrame(animate)
        } else {
          // 扫描完成
          if (scanLineEntity) {
            v.entities.remove(scanLineEntity)
            scanLineEntity = null
          }
          scanAnimationId = null
          resolve()
        }
      }
      scanAnimationId = requestAnimationFrame(animate)
    })
  }

  // ===== 运行 AI 分析 =====
  async function runAnalysis() {
    if (isAnalyzing.value || !viewer.value) return

    isAnalyzing.value = true
    analysisProgress.value = 0
    clearResults()

    const region = selectedRegion.value
    const model = selectedModel.value

    // 1. 飞到区域
    flyToRegion(region)
    drawRegionBoundary(region)
    await sleep(800)

    // 2. 执行扫描动画
    await startScanAnimation(region)

    // 3. 模拟推理
    analysisProgress.value = 92
    await sleep(model.inferenceTime * 0.3)

    // 4. 生成结果
    const detections = simulateAIDetection(region, model)
    targets.value = detections
    stats.value = calcDetectionStats(detections)
    analysisProgress.value = 100

    // 5. 渲染结果到地图
    renderTargets()

    await sleep(300)
    isAnalyzing.value = false
  }

  // ===== 渲染检测目标到地图 =====
  function renderTargets() {
    if (!viewer.value) return
    clearTargetEntities()

    for (const target of filteredTargets.value) {
      const catInfo = CATEGORY_INFO[target.category]
      const sevInfo = SEVERITY_INFO[target.severity]
      const color = Cesium.Color.fromCssColorString(catInfo.color)

      // 检测目标圈
      const entity = viewer.value.entities.add({
        position: Cesium.Cartesian3.fromDegrees(target.lon, target.lat),
        ellipse: {
          semiMajorAxis: target.radius,
          semiMinorAxis: target.radius,
          material: color.withAlpha(0.25),
          outline: true,
          outlineColor: color.withAlpha(0.9),
          outlineWidth: 2,
          height: 0,
        },
        billboard: {
          image: createTargetIcon(catInfo.icon, catInfo.color, target.severity),
          width: 36,
          height: 36,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${catInfo.label} ${Math.round(target.confidence * 100)}%`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, 8),
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          show: new Cesium.CallbackProperty(() => {
            // 仅在相机较近时显示标签
            if (!viewer.value) return false
            const camHeight = viewer.value.camera.positionCartographic.height
            return camHeight < 20000
          }, false),
        },
        properties: {
          targetId: target.id,
          category: target.category,
          confidence: target.confidence,
          severity: target.severity,
          description: target.description,
        },
      })
      targetEntities.push(entity)
    }
  }

  // ===== 创建目标图标 canvas =====
  function createTargetIcon(icon: string, color: string, severity: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = 36
    canvas.height = 36
    const ctx = canvas.getContext('2d')!

    // 外圈
    ctx.beginPath()
    ctx.arc(18, 18, 16, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.85
    ctx.fill()

    // 严重等级外环
    ctx.beginPath()
    ctx.arc(18, 18, 16, 0, Math.PI * 2)
    ctx.strokeStyle = severity === 3 ? '#FF0000' : severity === 2 ? '#FFA500' : '#4CAF50'
    ctx.lineWidth = 2.5
    ctx.globalAlpha = 1
    ctx.stroke()

    // emoji 图标
    ctx.font = '16px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 1
    ctx.fillText(icon, 18, 18)

    return canvas
  }

  // ===== 热力图 =====
  function toggleHeatmap() {
    showHeatmap.value = !showHeatmap.value
    if (showHeatmap.value) {
      renderHeatmap()
    } else {
      removeHeatmap()
    }
  }

  function renderHeatmap() {
    if (!viewer.value || filteredTargets.value.length === 0) return
    removeHeatmap()

    const region = selectedRegion.value
    const canvas = createHeatmapCanvas(filteredTargets.value, region)

    const lonSpan = region.radius / (111320 * Math.cos((region.center.lat * Math.PI) / 180))
    const latSpan = region.radius / 110540

    heatmapEntity = viewer.value.entities.add({
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(
          region.center.lon - lonSpan,
          region.center.lat - latSpan,
          region.center.lon + lonSpan,
          region.center.lat + latSpan,
        ),
        material: new Cesium.ImageMaterialProperty({
          image: canvas,
          transparent: true,
        }),
        height: 0,
      },
    })
  }

  function createHeatmapCanvas(
    targets: DetectionTarget[],
    region: AnalysisRegion,
  ): HTMLCanvasElement {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const lonSpan = region.radius / (111320 * Math.cos((region.center.lat * Math.PI) / 180))
    const latSpan = region.radius / 110540
    const west = region.center.lon - lonSpan
    const south = region.center.lat - latSpan

    // 渲染每个目标为径向渐变
    for (const t of targets) {
      const x = ((t.lon - west) / (lonSpan * 2)) * size
      const y = size - ((t.lat - south) / (latSpan * 2)) * size
      const r = (t.radius / (region.radius * 2)) * size * 4

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
      const catColor = CATEGORY_INFO[t.category].color
      gradient.addColorStop(0, catColor + '80')
      gradient.addColorStop(0.4, catColor + '40')
      gradient.addColorStop(1, catColor + '00')

      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }

    return canvas
  }

  function removeHeatmap() {
    if (heatmapEntity && viewer.value) {
      viewer.value.entities.remove(heatmapEntity)
      heatmapEntity = null
    }
  }

  // ===== 选中目标 =====
  function selectTarget(target: DetectionTarget | null) {
    selectedTarget.value = target
    if (target && viewer.value) {
      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(target.lon, target.lat, target.radius * 15),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-50),
          roll: 0,
        },
        duration: 1,
      })
    }
  }

  // ===== 过滤控制 =====
  function setConfidenceThreshold(val: number) {
    confidenceThreshold.value = val
  }

  function toggleCategory(cat: TargetCategory) {
    const cats = new Set(selectedCategories.value)
    if (cats.has(cat)) {
      cats.delete(cat)
    } else {
      cats.add(cat)
    }
    selectedCategories.value = cats
  }

  // ===== 更新渲染 =====
  watch([confidenceThreshold, selectedCategories], () => {
    if (targets.value.length > 0) {
      renderTargets()
      if (showHeatmap.value) renderHeatmap()
      // 更新统计
      stats.value = calcDetectionStats(filteredTargets.value)
    }
  })

  // ===== 清理 =====
  function clearTargetEntities() {
    if (!viewer.value) return
    for (const e of targetEntities) {
      viewer.value.entities.remove(e)
    }
    targetEntities = []
  }

  function clearResults() {
    clearTargetEntities()
    removeHeatmap()
    targets.value = []
    stats.value = null
    selectedTarget.value = null
    showHeatmap.value = false
  }

  function destroy() {
    if (scanAnimationId) {
      cancelAnimationFrame(scanAnimationId)
      scanAnimationId = null
    }
    if (viewer.value) {
      if (scanLineEntity) viewer.value.entities.remove(scanLineEntity)
      if (regionEntity) viewer.value.entities.remove(regionEntity)
      clearTargetEntities()
      removeHeatmap()
    }
  }

  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }

  return {
    // 状态
    selectedRegion,
    selectedModel,
    isAnalyzing,
    analysisProgress,
    targets,
    filteredTargets,
    stats,
    confidenceThreshold,
    selectedCategories,
    selectedTarget,
    showHeatmap,
    // 方法
    setRegion,
    setModel,
    runAnalysis,
    selectTarget,
    setConfidenceThreshold,
    toggleCategory,
    toggleHeatmap,
    flyToRegion,
    clearResults,
    destroy,
    // 常量
    AI_MODELS,
    ANALYSIS_REGIONS,
    CATEGORY_INFO,
    SEVERITY_INFO,
  }
}
