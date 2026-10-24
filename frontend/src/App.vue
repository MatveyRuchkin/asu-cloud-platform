<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <!--
      Временная навигация каркаса: нужна, чтобы проверить маршруты.
      Постоянный компонент навигации — задача FE-01 (Хапков), он заменит этот блок.
    -->
    <nav class="app__nav" aria-label="Основная навигация">
      <RouterLink class="app__link" to="/login">Вход</RouterLink>
      <RouterLink class="app__link" to="/ads">Объявления</RouterLink>
      <RouterLink class="app__link" to="/forum">Форум</RouterLink>
      <RouterLink class="app__link" to="/profile">Профиль</RouterLink>
    </nav>

    <RouterView />
  </div>
</template>
