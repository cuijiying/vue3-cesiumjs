import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/tileset-ground',
      name: 'tileset-ground',
      component: () => import('../views/TilesetGroundView.vue'),
      meta: {
        title: '3D Tiles 贴地加载',
        description: '加载 3D Tiles 图层并自动飞行定位到图层范围，基于地形采样进行贴地校正',
        icon: '🏙️',
      },
    },
    {
      path: '/drone-playback',
      name: 'drone-playback',
      component: () => import('../views/DronePlaybackView.vue'),
      meta: {
        title: '无人机轨迹回放',
        description: '查看无人机飞行轨迹的实时回放，支持多种飞行模式',
        icon: '🚁',
      },
    },
    {
      path: '/tianditu-imagery',
      name: 'tianditu-imagery',
      component: () => import('../views/TiandituImageryView.vue'),
      meta: {
        title: '天地图影像',
        description: '加载天地图卫星影像、矢量地图和地形晕渲图层，支持注记显示切换',
        icon: '🗺️',
      },
    },
    {
      path: '/tianditu-label3d',
      name: 'tianditu-label3d',
      component: () => import('../views/TiandituLabel3DView.vue'),
      meta: {
        title: '天地图3D注记',
        description: '基于天地图官方三维扩展（GeoWTFS）加载真实三维地名注记，叠加三维地形与影像/矢量底图',
        icon: '🏷️',
      },
    },
    {
      path: '/drone-patrol',
      name: 'drone-patrol',
      component: () => import('../views/DronePatrolView.vue'),
      meta: {
        title: '无人机巡查',
        description: '无人机按预设航线自动巡查，支持工业园区、河道、光伏电站等场景',
        icon: '🛸',
      },
    },
    {
      path: '/temperature-grid',
      name: 'temperature-grid',
      component: () => import('../views/TemperatureGridView.vue'),
      meta: {
        title: '温度格点图层',
        description: '基于WebGL渲染的温度格点可视化，支持色标切换、透明度调节和温度查询',
        icon: '🌡️',
      },
    },
    {
      path: '/split-screen',
      name: 'split-screen',
      component: () => import('../views/SplitScreenView.vue'),
      meta: {
        title: '二三维分屏联动',
        description: '左侧二维地图与右侧三维地球实时联动，相机位置双向同步',
        icon: '🔗',
      },
    },
    {
      path: '/wind-field',
      name: 'wind-field',
      component: () => import('../views/WindFieldView.vue'),
      meta: {
        title: '风场可视化',
        description: '基于粒子动画的风场可视化，支持风速配色、粒子密度和尾迹控制',
        icon: '🌬️',
      },
    },
    {
      path: '/wind-field-3d',
      name: 'wind-field-3d',
      component: () => import('../views/WindField3DView.vue'),
      meta: {
        title: '三维风场可视化',
        description: '多高度层三维风场粒子可视化，支持高度夸张、分层显隐和垂直气流展示',
        icon: '🌀',
      },
    },
    {
      path: '/temperature-grid-3d',
      name: 'temperature-grid-3d',
      component: () => import('../views/TemperatureGrid3DView.vue'),
      meta: {
        title: '三维温度格点图层',
        description: '三维柱状温度格点可视化，温度越高柱体越高，支持色标切换和高度夸张调节',
        icon: '🏔️',
      },
    },
    {
      path: '/elevation',
      name: 'elevation',
      component: () => import('../views/ElevationView.vue'),
      meta: {
        title: '高程图层',
        description: '三维柱状高程可视化，直观展示地形海拔高度，支持高度夸张、色标切换和高程查询',
        icon: '⛰️',
      },
    },
    {
      path: '/viewshed',
      name: 'viewshed',
      component: () => import('../views/ViewshedView.vue'),
      meta: {
        title: '可视域分析',
        description: '基于射线追踪的可视域分析，支持多场景预设、视锥可视化和可视率统计',
        icon: '👁️',
      },
    },
    {
      path: '/flood-analysis',
      name: 'flood-analysis',
      component: () => import('../views/FloodAnalysisView.vue'),
      meta: {
        title: '淹没分析',
        description: '基于地形高程的洪水淹没模拟，支持水位调节、淹没动画和面积统计',
        icon: '🌊',
      },
    },
    {
      path: '/ai-detection',
      name: 'ai-detection',
      component: () => import('../views/AIDetectionView.vue'),
      meta: {
        title: 'AI智能目标检测',
        description: '模拟AI遥感影像分析，支持多模型切换、区域检测、置信度过滤、热力图和目标分类统计',
        icon: '🤖',
      },
    },
    {
      path: '/radar-scan',
      name: 'radar-scan',
      component: () => import('../views/RadarScanView.vue'),
      meta: {
        title: '雷达三维扫描',
        description: '三维雷达扫描可视化，支持扫描速度、波束宽度、半径等参数实时调节，含目标探测动画',
        icon: '📡',
      },
    },
    {
      path: '/low-altitude-twin',
      name: 'low-altitude-twin',
      component: () => import('../views/LowAltitudeTwinView.vue'),
      meta: {
        title: '低空气象数字孪生',
        description: '低空气象 + Cesium数字孪生 + XR可视化 + AI飞行决策辅助，集成风场/降水/低云雾/湍流多要素气象、城市楼宇孪生、飞行走廊与AI风险评估',
        icon: '🛰️',
      },
    },
  ],
})

export default router
