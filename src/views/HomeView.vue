<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'

const cesiumContainer = ref<HTMLDivElement>()

onMounted(() => {
  if (!cesiumContainer.value) return

  // 设置 Cesium Ion 访问令牌（可选，使用默认资源）
  // Cesium.Ion.defaultAccessToken = 'your_access_token_here'

  // 创建 Viewer 实例
  const viewer = new Cesium.Viewer(cesiumContainer.value, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false, // 是否显示动画控件
    baseLayerPicker: true, // 是否显示图层选择器
    fullscreenButton: true, // 是否显示全屏按钮
    vrButton: false, // 是否显示 VR 按钮
    geocoder: true, // 是否显示地理编码器
    homeButton: true, // 是否显示主页按钮
    infoBox: true, // 是否显示信息框
    sceneModePicker: true, // 是否显示场景模式选择器
    selectionIndicator: true, // 是否显示选择指示器
    timeline: false, // 是否显示时间轴
    navigationHelpButton: true, // 是否显示导航帮助按钮
  })

  // 设置相机初始位置（中国区域）
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(116.391, 39.9, 10000000), // 北京上空
  })
})
</script>

<template>
  <main class="home-container">
    <div ref="cesiumContainer" class="cesium-container"></div>
  </main>
</template>

<style scoped lang="scss">
.home-container {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  .cesium-container {
    width: 100%;
    height: 100%;
  }
}


</style>
