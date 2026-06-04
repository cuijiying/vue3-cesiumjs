import { ref, shallowRef, onUnmounted, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import {
  generateWindField3D,
  interpolateWind3D,
  WIND3D_COLOR_SCALES,
  type WindField3DData,
  type Wind3DColorScaleName,
} from '@/data/windField3D'

interface Wind3DParticle {
  lon: number
  lat: number
  alt: number
  screenX: number
  screenY: number
  age: number
  maxAge: number
}

export function useWindField3D(viewerRef: ShallowRef<Cesium.Viewer | null>) {
  const isVisible = ref(true)
  const isLoading = ref(false)
  const particleCount = ref(800)
  const speedFactor = ref(1.0)
  const fadeOpacity = ref(0.93)
  const lineWidth = ref(2.0)
  const colorScale = ref<Wind3DColorScaleName>('rainbow')
  const heightScale = ref(30)
  const windData = shallowRef<WindField3DData | null>(null)
  const visibleLevels = ref<boolean[]>([])

  let particles: Wind3DParticle[] = []
  let overlayCanvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let animationId: number | null = null
  let running = false
  let resizeObserver: ResizeObserver | null = null

  // Cesium scratch objects (avoid per-frame allocation)
  const scratchCartographic = new Cesium.Cartographic()
  const scratchCartesian = new Cesium.Cartesian3()
  const scratchScreen = new Cesium.Cartesian2()
  let lastCamX = 0
  let lastCamY = 0
  let lastCamZ = 0

  // ===================== Data =====================

  function loadData(cols = 36, rows = 36) {
    isLoading.value = true
    windData.value = generateWindField3D(cols, rows)
    visibleLevels.value = windData.value.levels.map(() => true)
    initParticles()
    isLoading.value = false
  }

  // ===================== Particles =====================

  function initParticles() {
    particles = []
    for (let i = 0; i < particleCount.value; i++) {
      particles.push(createParticle())
    }
  }

  function createParticle(): Wind3DParticle {
    const d = windData.value!
    const levelIdx = Math.floor(Math.random() * d.levels.length)
    return {
      lon: d.lonMin + Math.random() * (d.lonMax - d.lonMin),
      lat: d.latMin + Math.random() * (d.latMax - d.latMin),
      alt: d.levels[levelIdx]!,
      screenX: -1,
      screenY: -1,
      age: Math.floor(Math.random() * 60),
      maxAge: 60 + Math.floor(Math.random() * 40),
    }
  }

  function resetParticle(p: Wind3DParticle) {
    const d = windData.value!
    const levelIdx = Math.floor(Math.random() * d.levels.length)
    p.lon = d.lonMin + Math.random() * (d.lonMax - d.lonMin)
    p.lat = d.latMin + Math.random() * (d.latMax - d.latMin)
    p.alt = d.levels[levelIdx]!
    p.screenX = -1
    p.screenY = -1
    p.age = 0
    p.maxAge = 60 + Math.floor(Math.random() * 40)
  }

  // ===================== Canvas =====================

  function setupCanvas(container: HTMLElement) {
    overlayCanvas = document.createElement('canvas')
    overlayCanvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1'

    const rect = container.getBoundingClientRect()
    overlayCanvas.width = rect.width * window.devicePixelRatio
    overlayCanvas.height = rect.height * window.devicePixelRatio

    ctx = overlayCanvas.getContext('2d')!
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    container.appendChild(overlayCanvas)

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (!overlayCanvas) return
        const { width, height } = entry.contentRect
        overlayCanvas.width = width * window.devicePixelRatio
        overlayCanvas.height = height * window.devicePixelRatio
        ctx = overlayCanvas.getContext('2d')!
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
    })
    resizeObserver.observe(container)
  }

  // ===================== Color =====================

  function getSpeedColor(speed: number, alpha: number): string {
    const max = windData.value!.maxSpeed
    const t = Math.min(1, speed / max)
    const stops = WIND3D_COLOR_SCALES[colorScale.value]

    let lo = 0
    let hi = stops.length - 1
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i]!.threshold && t <= stops[i + 1]!.threshold) {
        lo = i
        hi = i + 1
        break
      }
    }

    const stopLo = stops[lo]!
    const stopHi = stops[hi]!
    const range = stopHi.threshold - stopLo.threshold || 1
    const f = (t - stopLo.threshold) / range
    const r = Math.round(stopLo.color[0] + (stopHi.color[0] - stopLo.color[0]) * f)
    const g = Math.round(stopLo.color[1] + (stopHi.color[1] - stopLo.color[1]) * f)
    const b = Math.round(stopLo.color[2] + (stopHi.color[2] - stopLo.color[2]) * f)

    return `rgba(${r},${g},${b},${alpha})`
  }

  function findClosestLevel(alt: number, levels: number[]): number {
    let closest = 0
    let minDist = Math.abs(alt - levels[0]!)
    for (let i = 1; i < levels.length; i++) {
      const d = Math.abs(alt - levels[i]!)
      if (d < minDist) {
        minDist = d
        closest = i
      }
    }
    return closest
  }

  // ===================== Animation =====================

  function startAnimation() {
    if (running) return
    running = true
    animate()
  }

  function stopAnimation() {
    running = false
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  function animate() {
    if (!running || !viewerRef.value || !ctx || !overlayCanvas || !windData.value) return

    const viewer = viewerRef.value
    const scene = viewer.scene
    const data = windData.value
    const w = overlayCanvas.width / window.devicePixelRatio
    const h = overlayCanvas.height / window.devicePixelRatio
    const hScale = heightScale.value

    if (!isVisible.value) {
      ctx.clearRect(0, 0, w, h)
      animationId = requestAnimationFrame(animate)
      return
    }

    // Detect camera movement
    const cam = viewer.camera.position
    const cameraMoved =
      Math.abs(cam.x - lastCamX) > 0.01 ||
      Math.abs(cam.y - lastCamY) > 0.01 ||
      Math.abs(cam.z - lastCamZ) > 0.01
    lastCamX = cam.x
    lastCamY = cam.y
    lastCamZ = cam.z

    // Fade existing trails
    const prevComp = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'destination-in'
    ctx.fillStyle = `rgba(0,0,0,${fadeOpacity.value})`
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = prevComp

    // Adjust particle count dynamically
    while (particles.length < particleCount.value) particles.push(createParticle())
    while (particles.length > particleCount.value) particles.pop()

    const factor = speedFactor.value * 0.003

    for (const p of particles) {
      // Check level visibility
      const levelIdx = findClosestLevel(p.alt, data.levels)
      if (!visibleLevels.value[levelIdx]) {
        p.screenX = -1
        p.screenY = -1
        continue
      }

      const wind = interpolateWind3D(data, p.lon, p.lat, p.alt)
      if (!wind) {
        resetParticle(p)
        continue
      }

      const prevX = cameraMoved ? -1 : p.screenX
      const prevY = cameraMoved ? -1 : p.screenY

      // Advance particle in 3D geographic space
      const cosLat = Math.cos((p.lat * Math.PI) / 180) || 0.01
      p.lon += (wind.u * factor) / cosLat
      p.lat += wind.v * factor
      p.alt += wind.w * factor * 500
      p.age++

      // Clamp altitude
      const minAlt = data.levels[0]!
      const maxAlt = data.levels[data.levels.length - 1]!
      p.alt = Math.max(minAlt, Math.min(maxAlt, p.alt))

      if (
        p.lon < data.lonMin ||
        p.lon > data.lonMax ||
        p.lat < data.latMin ||
        p.lat > data.latMax ||
        p.age > p.maxAge
      ) {
        resetParticle(p)
        continue
      }

      // Project to screen coordinates (with height exaggeration)
      scratchCartographic.longitude = Cesium.Math.toRadians(p.lon)
      scratchCartographic.latitude = Cesium.Math.toRadians(p.lat)
      scratchCartographic.height = p.alt * hScale
      Cesium.Ellipsoid.WGS84.cartographicToCartesian(scratchCartographic, scratchCartesian)

      const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
        scene,
        scratchCartesian,
        scratchScreen,
      )

      if (!screenPos) {
        p.screenX = -1
        p.screenY = -1
        continue
      }

      p.screenX = screenPos.x
      p.screenY = screenPos.y

      // Draw trail segment
      if (prevX >= 0 && prevY >= 0) {
        const dx = p.screenX - prevX
        const dy = p.screenY - prevY
        if (dx * dx + dy * dy > 10000) continue // skip long jumps

        const spd = Math.sqrt(wind.u * wind.u + wind.v * wind.v + wind.w * wind.w)
        const alpha =
          Math.min(0.9, spd / data.maxSpeed + 0.1) * (1 - (p.age / p.maxAge) * 0.5)

        ctx.strokeStyle = getSpeedColor(spd, alpha)
        ctx.lineWidth = lineWidth.value
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(p.screenX, p.screenY)
        ctx.stroke()
      }
    }

    animationId = requestAnimationFrame(animate)
  }

  // ===================== Controls =====================

  function toggleVisibility() {
    isVisible.value = !isVisible.value
    if (!isVisible.value && ctx && overlayCanvas) {
      const w = overlayCanvas.width / window.devicePixelRatio
      const h = overlayCanvas.height / window.devicePixelRatio
      ctx.clearRect(0, 0, w, h)
    }
  }

  function toggleLevel(levelIdx: number) {
    visibleLevels.value[levelIdx] = !visibleLevels.value[levelIdx]
  }

  function flyToLayer() {
    if (!viewerRef.value || !windData.value) return
    const d = windData.value
    const midAlt = d.levels[Math.floor(d.levels.length / 2)]! * heightScale.value
    viewerRef.value.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        (d.lonMin + d.lonMax) / 2,
        (d.latMin + d.latMax) / 2 - 15,
        midAlt + 4000000,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0.0,
      },
    })
  }

  function setParticleCount(count: number) {
    particleCount.value = Math.max(100, Math.min(3000, count))
  }

  function setSpeedFactor(val: number) {
    speedFactor.value = Math.max(0.1, Math.min(5, val))
  }

  function setFadeOpacity(val: number) {
    fadeOpacity.value = Math.max(0.8, Math.min(0.99, val))
  }

  function setLineWidth(val: number) {
    lineWidth.value = Math.max(0.5, Math.min(5, val))
  }

  function setHeightScale(val: number) {
    heightScale.value = Math.max(1, Math.min(100, val))
  }

  function setColorScale(name: Wind3DColorScaleName) {
    colorScale.value = name
  }

  function destroy() {
    stopAnimation()
    resizeObserver?.disconnect()
    resizeObserver = null
    if (overlayCanvas?.parentElement) {
      overlayCanvas.parentElement.removeChild(overlayCanvas)
    }
    overlayCanvas = null
    ctx = null
    particles = []
  }

  onUnmounted(destroy)

  return {
    isVisible,
    isLoading,
    particleCount,
    speedFactor,
    fadeOpacity,
    lineWidth,
    colorScale,
    heightScale,
    windData,
    visibleLevels,
    loadData,
    setupCanvas,
    startAnimation,
    stopAnimation,
    flyToLayer,
    toggleVisibility,
    toggleLevel,
    setParticleCount,
    setSpeedFactor,
    setFadeOpacity,
    setLineWidth,
    setHeightScale,
    setColorScale,
    destroy,
  }
}
