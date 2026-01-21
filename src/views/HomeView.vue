<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="home-view">
    <h1>Vue3 + CesiumJS 项目</h1>
    <div class="demo-links">
      <router-link to="/drone-playback" class="demo-card">
        <div class="icon">🚁</div>
        <h2>无人机轨迹回放</h2>
        <p>查看无人机飞行轨迹的实时回放，支持多种飞行模式</p>
      </router-link>
    </div>
  </main>
</template>

<style scoped lang="scss">
.home-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  h1 {
    color: white;
    font-size: 3rem;
    margin-bottom: 60px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .demo-links {
    display: flex;
    gap: 30px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .demo-card {
    background: white;
    border-radius: 16px;
    padding: 40px;
    width: 320px;
    text-decoration: none;
    color: #333;
    transition: all 0.3s ease;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    cursor: pointer;

    &:hover {
      transform: translateY(-10px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .icon {
      font-size: 4rem;
      text-align: center;
      margin-bottom: 20px;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 10px;
      color: #667eea;
    }

    p {
      color: #666;
      line-height: 1.6;
    }
  }
}
</style>
