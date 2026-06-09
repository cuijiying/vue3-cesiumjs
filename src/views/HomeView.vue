<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent, shallowRef, watch, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { format, fromNow, parse, formatDuration, add } from 'time-formatter-ts'

// Format a date
format(new Date(), 'YYYY-MM-DD HH:mm:ss')
// → '2026-02-27 14:30:05'

// Relative time
fromNow(Date.now() - 5 * 60 * 1000)
// → '5 minutes ago'

// Parse a date string
parse('Feb 27, 2026 3:30 PM')
// → Date object

// Format a duration
formatDuration({ hours: 2, minutes: 30 })
// → '2 hours 30 minutes'

// Calendar ops
add(new Date(), 7, 'days')
// → Date 7 days from now
const router = useRouter()

// 定义demo路由的元数据类型
interface DemoRoute {
  path: string
  name: string
  title: string
  description: string
  icon: string
  component: any
}

// 从路由配置中获取demo列表（排除home）
const demoList = computed<DemoRoute[]>(() => {
  return router.getRoutes()
    .filter(route => route.path !== '/' && route.name !== 'home')
    .map(route => ({
      path: route.path,
      name: route.name as string,
      title: route.meta?.title as string || getDemoTitle(route.path),
      description: route.meta?.description as string || getDemoDescription(route.path),
      icon: route.meta?.icon as string || getDemoIcon(route.path),
      component: route.components?.default
    }))
})

// 根据路径获取demo标题（fallback）
function getDemoTitle(path: string): string {
  const titleMap: Record<string, string> = {
    '/drone-playback': '无人机轨迹回放',
    '/tianditu-imagery': '天地图影像'
  }
  return titleMap[path] || path.replace(/^\//, '').replace(/-/g, ' ')
}

// 根据路径获取demo描述（fallback）
function getDemoDescription(path: string): string {
  const descMap: Record<string, string> = {
    '/drone-playback': '查看无人机飞行轨迹的实时回放，支持多种飞行模式',
    '/tianditu-imagery': '加载天地图卫星影像、矢量地图和地形晕渲图层'
  }
  return descMap[path] || ''
}

// 根据路径获取demo图标（fallback）
function getDemoIcon(path: string): string {
  const iconMap: Record<string, string> = {
    '/drone-playback': '🚁',
    '/tianditu-imagery': '🗺️'
  }
  return iconMap[path] || '📦'
}

// 当前选中的demo索引
const selectedIndex = ref(0)

// 当前选中的demo
const selectedDemo = computed(() => demoList.value[selectedIndex.value])

// 当前显示的组件
const currentComponent = shallowRef<any>(null)

// 选择demo
function selectDemo(index: number) {
  selectedIndex.value = index
}

// 监听选中的demo变化，更新组件
watch(selectedDemo, async (demo) => {
  if (demo?.component) {
    // 如果是异步组件（函数），需要调用并获取组件
    if (typeof demo.component === 'function') {
      try {
        const module = await demo.component()
        currentComponent.value = markRaw(module.default || module)
      } catch (e) {
        console.error('Failed to load component:', e)
        currentComponent.value = null
      }
    } else {
      currentComponent.value = markRaw(demo.component)
    }
  } else {
    currentComponent.value = null
  }
}, { immediate: true })

// 默认选中第一个demo
onMounted(() => {
  if (demoList.value.length > 0) {
    selectedIndex.value = 0
  }
})

// 测试time-formatter-ts相关功能
console.log(format(new Date(), 'YYYY-MM-DD HH:mm:ss'))
console.log(fromNow(Date.now() - 5 * 60 * 1000))
console.log(parse('Feb 27, 2026 3:30 PM'))
console.log(formatDuration({ hours: 2, minutes: 30 }))
console.log(add(new Date(), 7, 'days'))

</script>

<template>
  <main class="home-view">
    <!-- 左侧：demo列表 -->
    <aside class="demo-sidebar">
      <div class="sidebar-header">
        <h1>Demo 列表</h1>
      </div>
      <ul class="demo-list">
        <li
          v-for="(demo, index) in demoList"
          :key="demo.name"
          class="demo-item"
          :class="{ active: selectedIndex === index }"
          @click="selectDemo(index)"
        >
          <span class="demo-icon">{{ demo.icon }}</span>
          <span class="demo-title">{{ demo.title }}</span>
        </li>
      </ul>
    </aside>

    <!-- 右侧：demo详情和预览 -->
    <section class="demo-content">
      <div v-if="selectedDemo" class="demo-detail">
        <div class="demo-header">
          <div class="demo-icon-large">{{ selectedDemo.icon }}</div>
          <div class="demo-info">
            <h2>{{ selectedDemo.title }}</h2>
            <p class="demo-description">{{ selectedDemo.description }}</p>
          </div>
        </div>
        <div class="demo-preview">
          <component v-if="currentComponent" :is="currentComponent" />
          <div v-else class="preview-placeholder">
            <span class="preview-icon">{{ selectedDemo.icon }}</span>
            <p>加载中...</p>
          </div>
        </div>
      </div>
      <div v-else class="no-demo">
        <p>暂无Demo</p>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
.home-view {
  height: 100vh;
  display: flex;
  background: #f5f5f5;
  overflow: hidden;
}

// 左侧边栏
.demo-sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);

  .sidebar-header {
    padding: 10px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    h1 {
      font-size: 1.5rem;
      margin: 0;
    }
  }

  .demo-list {
    list-style: none;
    padding: 10px 0;
    margin: 0;
    overflow-y: auto;

    .demo-item {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;

      .demo-icon {
        font-size: 1.5rem;
      }

      .demo-title {
        font-size: 0.95rem;
        color: #333;
        font-weight: 500;
      }

      &:hover {
        background: #f8f9fa;
      }

      &.active {
        background: #f0f3ff;
        border-left-color: #667eea;

        .demo-title {
          color: #667eea;
          font-weight: 600;
        }
      }
    }
  }
}

// 右侧内容区
.demo-content {
  flex: 1;
  padding: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;

  .demo-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;

    .demo-header {
      background: white;
      border-radius: 12px;
      padding: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 10px;
      flex-shrink: 0;

      .demo-icon-large {
        font-size: 3rem;
        flex-shrink: 0;
      }

      .demo-info {
        flex: 1;

        h2 {
          font-size: 1.5rem;
          margin: 0 0 8px 0;
          color: #333;
        }

        .demo-description {
          font-size: 0.95rem;
          color: #666;
          line-height: 1.5;
          margin: 0;
        }
      }
    }

    .demo-preview {
      flex: 1;
      background: white;
      border-radius: 12px;
      padding: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;

      .preview-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #999;

        .preview-icon {
          font-size: 4rem;
          margin-bottom: 15px;
          opacity: 0.3;
        }

        p {
          font-size: 1rem;
        }
      }

      // 确保内嵌的组件占满整个容器
      :deep(> *) {
        width: 100%;
        height: 100%;
      }
    }
  }

  .no-demo {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
    font-size: 1.2rem;
  }
}
</style>
