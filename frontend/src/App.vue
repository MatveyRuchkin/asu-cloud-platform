<script setup lang="ts">
import { RouterView } from 'vue-router'

import AppNavigation from '@/components/AppNavigation.vue'
</script>

<template>
  <div class="app">
    <!-- Оболочка приложения: навигация и область страницы. Страницы живут в src/views. -->
    <AppNavigation />

    <main class="app__content">
      <RouterView />
    </main>
  </div>
</template>
