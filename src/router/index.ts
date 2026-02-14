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
  ],
})

export default router
