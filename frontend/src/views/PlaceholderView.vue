<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <!-- Оболочка уже даёт main: страница начинается с секции, чтобы не было двух главных областей. -->
  <section class="page">
    <h1 class="page__title">{{ route.meta.title ?? 'Страница' }}</h1>
    <p class="page__hint">
      Заглушка каркаса (ARCH-01). Наполнение страницы — задача FE-02…FE-04, общий каркас приложения
      — FE-01. Схема работы с API: docs/architecture/structure.md.
    </p>
  </section>
</template>
