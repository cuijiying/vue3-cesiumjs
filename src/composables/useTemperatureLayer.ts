import { ref, shallowRef, onUnmounted, watch, type Ref } from 'vue'
import * as Cesium from 'cesium'
import {
  generateTemperatureGrid,
  COLOR_SCALES,
  type TemperatureGridData,
  type ColorScaleName,
} from '@/data/temperatureGrid'

// ===================== WebGL 温度渲染器 =====================

/** 顶点着色器：全屏四边形（Y 轴翻转以匹配地理坐标：数据 row0=北 → 图片顶部=北） */
const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_texCoord;
  void main() {
    v_texCoord = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

/** 片元着色器：从温度纹理采样 → 归一化 → 色标映射 → 过滤 → 输出颜色 */
const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_texCoord;

  uniform sampler2D u_tempTexture;   // 温度数据纹理 (R通道存归一化温度)
  uniform sampler2D u_colorScale;    // 色标查找表
  uniform float u_filterMin;         // 过滤下限 (归一化 0-1)
  uniform float u_filterMax;         // 过滤上限 (归一化 0-1)

  void main() {
    float temp = texture2D(u_tempTexture, v_texCoord).r;
    // 超出过滤范围的像素变透明
    if (temp < u_filterMin || temp > u_filterMax) {
      discard;
    }
    vec4 color = texture2D(u_colorScale, vec2(temp, 0.5));
    gl_FragColor = color;
  }
`

/**
 * 使用 WebGL 将温度格点数据渲染为 RGBA 图像
 */
class WebGLTemperatureRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private tempTexture: WebGLTexture
  private colorTexture: WebGLTexture

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height

    const gl = this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL 不可用')
    this.gl = gl

    // 编译着色器、链接程序
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)

    // 创建全屏四边形顶点
    this.setupQuad()

    // 创建纹理
    this.tempTexture = this.createTexture()
    this.colorTexture = this.createTexture()
  }

  // ---------- 内部辅助 ----------

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader 编译失败: ${info}`)
    }
    return shader
  }

  private createProgram(vsSrc: string, fsSrc: string): WebGLProgram {
    const gl = this.gl
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSrc)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program 链接失败: ${gl.getProgramInfoLog(program)}`)
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return program
  }

  private setupQuad() {
    const gl = this.gl
    const buffer = gl.createBuffer()!
    // prettier-ignore
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ])
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const loc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return tex
  }

  // ---------- 公开接口 ----------

  /**
   * 上传温度数据到 GPU 纹理（存入 R 通道，归一化到 0-1）
   */
  uploadTemperatureData(data: TemperatureGridData) {
    const gl = this.gl
    const { cols, rows, values, minTemp, maxTemp } = data
    const range = maxTemp - minTemp || 1

    // 将温度值归一化后写入 LUMINANCE 纹理
    const pixels = new Uint8Array(rows * cols)
    for (let i = 0; i < values.length; i++) {
      pixels[i] = Math.round(((values[i]! - minTemp) / range) * 255)
    }

    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, cols, rows, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, pixels)
  }

  /**
   * 上传色标查找表到 GPU 纹理
   */
  uploadColorScale(stops: readonly [number, number, number, number][]) {
    const gl = this.gl
    const width = 256
    const pixels = new Uint8Array(width * 4)

    for (let i = 0; i < width; i++) {
      const t = i / (width - 1)
      // 找到 t 所在的区间并插值
      let lo = 0
      let hi = stops.length - 1
      for (let s = 0; s < stops.length - 1; s++) {
        if (t >= stops[s]![0] && t <= stops[s + 1]![0]) {
          lo = s
          hi = s + 1
          break
        }
      }
      const stopLo = stops[lo]!
      const stopHi = stops[hi]!
      const range = stopHi[0] - stopLo[0] || 1
      const f = (t - stopLo[0]) / range
      pixels[i * 4 + 0] = Math.round(stopLo[1] + (stopHi[1] - stopLo[1]) * f)
      pixels[i * 4 + 1] = Math.round(stopLo[2] + (stopHi[2] - stopLo[2]) * f)
      pixels[i * 4 + 2] = Math.round(stopLo[3] + (stopHi[3] - stopLo[3]) * f)
      pixels[i * 4 + 3] = 255
    }

    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  }

  /**
   * 执行 WebGL 渲染，返回 canvas
   * @param filterMin 过滤下限（归一化 0-1）
   * @param filterMax 过滤上限（归一化 0-1）
   */
  render(filterMin = 0, filterMax = 1): HTMLCanvasElement {
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program)

    // 绑定温度纹理到 unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_tempTexture'), 0)

    // 绑定色标纹理到 unit 1
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_colorScale'), 1)

    // 设置过滤范围
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_filterMin'), filterMin)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_filterMax'), filterMax)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    return this.canvas
  }

  destroy() {
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteTexture(this.tempTexture)
    gl.deleteTexture(this.colorTexture)
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}

// ===================== Composable =====================

export function useTemperatureLayer(viewer: Ref<Cesium.Viewer | null>) {
  const isVisible = ref(true)
  const opacity = ref(0.7)
  const colorScale = ref<ColorScaleName>('classic')
  const gridData = shallowRef<TemperatureGridData | null>(null)
  const isLoading = ref(false)
  /** 过滤范围：实际温度值 [min, max] */
  const filterMin = ref(-Infinity)
  const filterMax = ref(Infinity)

  let renderer: WebGLTemperatureRenderer | null = null
  let imageryLayer: Cesium.ImageryLayer | null = null
  /** 防止并发 updateLayer 导致重复添加图层 */
  let updateVersion = 0
  /** 过滤防抖定时器 */
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null

  /** 生成温度数据并初始化 WebGL 渲染器 */
  async function loadData(cols = 128, rows = 128) {
    isLoading.value = true
    try {
      gridData.value = generateTemperatureGrid(cols, rows)
      renderer = new WebGLTemperatureRenderer(512, 512)
      renderer.uploadTemperatureData(gridData.value)
      renderer.uploadColorScale(COLOR_SCALES[colorScale.value])
      await updateLayer()
    } finally {
      isLoading.value = false
    }
  }

  /** 计算归一化过滤范围 */
  function getNormalizedFilter(): [number, number] {
    if (!gridData.value) return [0, 1]
    const { minTemp, maxTemp } = gridData.value
    const range = maxTemp - minTemp || 1
    const nMin = Math.max(0, (filterMin.value - minTemp) / range)
    const nMax = Math.min(1, (filterMax.value - minTemp) / range)
    return [nMin, nMax]
  }

  /** 将 WebGL 渲染结果叠加到 Cesium（先建新图层，再移除旧图层，避免闪烁） */
  async function updateLayer() {
    if (!viewer.value || !renderer || !gridData.value) return

    // 版本号递增，后续用于检测是否有更新的调用
    const thisVersion = ++updateVersion

    // 计算过滤范围并用 WebGL 渲染图片
    const [fMin, fMax] = getNormalizedFilter()
    const canvas = renderer.render(fMin, fMax)
    const imageUrl = canvas.toDataURL('image/png')

    // 缓存当前 gridData 引用和旧图层引用，防止 await 期间被修改
    const currentData = gridData.value
    const oldLayer = imageryLayer

    const provider = await Cesium.SingleTileImageryProvider.fromUrl(imageUrl, {
      rectangle: Cesium.Rectangle.fromDegrees(
        currentData.lonMin,
        currentData.latMin,
        currentData.lonMax,
        currentData.latMax,
      ),
    })

    // 防止在 await 期间 viewer 已销毁或有更新的调用
    if (!viewer.value || thisVersion !== updateVersion) return

    // 先添加新图层
    imageryLayer = viewer.value.imageryLayers.addImageryProvider(provider)
    imageryLayer.alpha = opacity.value
    imageryLayer.show = isVisible.value

    // 再移除旧图层（无缝切换，无闪烁）
    if (oldLayer && viewer.value) {
      viewer.value.imageryLayers.remove(oldLayer)
    }
  }

  /** 移除图层 */
  function removeLayer() {
    if (imageryLayer && viewer.value) {
      viewer.value.imageryLayers.remove(imageryLayer)
      imageryLayer = null
    }
  }

  /** 切换可见性 */
  function toggleVisibility(visible?: boolean) {
    isVisible.value = visible ?? !isVisible.value
    if (imageryLayer) {
      imageryLayer.show = isVisible.value
    }
  }

  /** 更新透明度（直接修改图层 alpha，不重建图层） */
  function setOpacity(val: number) {
    opacity.value = Math.max(0, Math.min(1, val))
    if (imageryLayer) {
      imageryLayer.alpha = opacity.value
    }
  }

  /** 切换色标方案（不再触发 watch，直接处理） */
  async function setColorScale(name: ColorScaleName) {
    colorScale.value = name
    if (renderer) {
      renderer.uploadColorScale(COLOR_SCALES[name])
      await updateLayer()
    }
  }

  /** 设置温度过滤范围（防抖，拖动滑块不闪烁） */
  function setFilterRange(min: number, max: number) {
    filterMin.value = min
    filterMax.value = max
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
    filterDebounceTimer = setTimeout(() => {
      updateLayer()
    }, 80)
  }

  /** 重置过滤范围为全部显示 */
  function resetFilter() {
    filterMin.value = -Infinity
    filterMax.value = Infinity
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
    updateLayer()
  }

  /** 飞到温度图层范围 */
  function flyToLayer() {
    if (!viewer.value || !gridData.value) return
    const { lonMin, latMin, lonMax, latMax } = gridData.value
    viewer.value.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(lonMin, latMin, lonMax, latMax),
      duration: 1.5,
    })
  }

  /** 根据经纬度查询温度值 */
  function queryTemperature(lon: number, lat: number): number | null {
    if (!gridData.value) return null
    const { lonMin, lonMax, latMin, latMax, cols, rows, values } = gridData.value

    if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) return null

    // 双线性插值
    const fx = ((lon - lonMin) / (lonMax - lonMin)) * (cols - 1)
    const fy = ((latMax - lat) / (latMax - latMin)) * (rows - 1)

    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const x1 = Math.min(x0 + 1, cols - 1)
    const y1 = Math.min(y0 + 1, rows - 1)
    const dx = fx - x0
    const dy = fy - y0

    const v00 = values[y0 * cols + x0]!
    const v10 = values[y0 * cols + x1]!
    const v01 = values[y1 * cols + x0]!
    const v11 = values[y1 * cols + x1]!

    return v00 * (1 - dx) * (1 - dy) + v10 * dx * (1 - dy) + v01 * (1 - dx) * dy + v11 * dx * dy
  }

  onUnmounted(() => {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
    removeLayer()
    renderer?.destroy()
    renderer = null
  })

  return {
    isVisible,
    opacity,
    colorScale,
    gridData,
    isLoading,
    filterMin,
    filterMax,
    loadData,
    updateLayer,
    removeLayer,
    toggleVisibility,
    setOpacity,
    setColorScale,
    setFilterRange,
    resetFilter,
    flyToLayer,
    queryTemperature,
  }
}
