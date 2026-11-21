<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { fetchForumSections } from '@/api/forum'
import { ApiError } from '@/api/http'
import type { ForumSection } from '@/api/types'

/** Разделы форума, полученные из API. */
const sections = ref<ForumSection[]>([])

/** Текущее состояние экрана: загрузка, ошибка или готовые данные. */
const isLoading = ref(false)
const errorMessage = ref('')

/** Признак того, что загрузка ещё не начиналась (для первого рендера). */
const hasLoaded = ref(false)

async function loadSections(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    sections.value = await fetchForumSections()
  } catch (error: unknown) {
    sections.value = []
    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : 'Не удалось загрузить разделы форума. Проверьте соединение и попробуйте ещё раз.'
  } finally {
    isLoading.value = false
    hasLoaded.value = true
  }
}

onMounted(loadSections)
</script>

<template>
  <main class="page forum-sections">
    <header class="forum-sections__header">
      <h1 class="page__title">Разделы форума</h1>
      <p class="page__hint">Выберите раздел, чтобы посмотреть темы и ответы студентов.</p>
    </header>

    <!-- Состояние загрузки -->
    <p v-if="isLoading" class="forum-sections__status" role="status" aria-live="polite">
      Загружаем разделы форума…
    </p>

    <!-- Состояние ошибки с повторной попыткой -->
    <div
      v-else-if="errorMessage"
      class="forum-sections__status forum-sections__status--error"
      role="alert"
    >
      <p class="forum-sections__message">{{ errorMessage }}</p>
      <button class="forum-sections__retry" type="button" @click="loadSections">Повторить</button>
    </div>

    <!-- Пустой ответ сервера -->
    <p
      v-else-if="hasLoaded && sections.length === 0"
      class="forum-sections__status"
      role="status"
      aria-live="polite"
    >
      Разделы форума пока не добавлены.
    </p>

    <!-- Список разделов -->
    <ul v-else class="forum-sections__list">
      <li v-for="section in sections" :key="section.id" class="forum-section">
        <h2 class="forum-section__title">{{ section.name }}</h2>
        <p v-if="section.description" class="forum-section__description">
          {{ section.description }}
        </p>
        <p v-else class="forum-section__description forum-section__description--muted">
          Описание отсутствует
        </p>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.forum-sections__header {
  margin-bottom: calc(var(--space) * 1.25);
}

.forum-sections__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space);
  padding: 0;
  margin: 0;
  list-style: none;
}

.forum-section {
  padding: calc(var(--space) * 1.25);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
}

.forum-section__title {
  margin: 0 0 calc(var(--space) / 2);
  font-size: 1.125rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.forum-section__description {
  margin: 0;
  color: var(--color-muted);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.forum-section__description--muted {
  font-style: italic;
}

.forum-sections__status {
  padding: calc(var(--space) * 1.25);
  color: var(--color-muted);
  text-align: center;
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
}

.forum-sections__status--error {
  color: #b42318;
  border-color: #fda29b;
  background: #fef3f2;
}

.forum-sections__message {
  margin: 0 0 var(--space);
}

.forum-sections__retry {
  padding: 8px 16px;
  color: #ffffff;
  font: inherit;
  background: var(--color-accent);
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
}

.forum-sections__retry:hover {
  filter: brightness(1.1);
}

.forum-sections__retry:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (max-width: 600px) {
  .forum-sections__list {
    grid-template-columns: 1fr;
  }

  .forum-section {
    padding: var(--space);
  }
}
</style>
