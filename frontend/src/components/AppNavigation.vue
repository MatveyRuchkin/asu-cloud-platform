<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Общая навигация каркаса (FE-01, Issue #8).
 *
 * Список разделов описан только здесь: новый раздел добавляется ссылкой в `links`
 * и маршрутом в `src/router/index.ts`. Страницы из `src/views` этот файл не меняют.
 */
const route = useRoute()

const isOpen = ref(false)

const links = [
  { to: '/login', label: 'Вход' },
  { to: '/ads', label: 'Объявления' },
  { to: '/forum', label: 'Форум' },
  { to: '/profile', label: 'Профиль' },
] as const

// На телефоне меню закрывается после перехода, иначе оно перекрывает страницу.
watch(
  () => route.fullPath,
  () => {
    isOpen.value = false
  },
)

// Escape закрывает раскрытое меню: привычное поведение для клавиатуры.
function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('keydown', closeOnEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', closeOnEscape))
</script>

<template>
  <header class="nav">
    <RouterLink class="nav__brand" to="/ads">ASU Cloud</RouterLink>

    <button
      class="nav__toggle"
      type="button"
      aria-controls="app-navigation"
      :aria-expanded="isOpen"
      :aria-label="isOpen ? 'Закрыть меню' : 'Открыть меню'"
      @click="isOpen = !isOpen"
    ></button>

    <nav
      id="app-navigation"
      class="nav__list"
      :class="{ 'nav__list--open': isOpen }"
      aria-label="Основная навигация"
    >
      <RouterLink v-for="link in links" :key="link.to" class="nav__link" :to="link.to">
        {{ link.label }}
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
  padding: var(--space) 0;
  border-bottom: 1px solid var(--color-border);
}

.nav__brand {
  color: var(--color-text);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
}

.nav__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space);
}

.nav__link {
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
  color: var(--color-muted);
  text-decoration: none;
}

.nav__link:hover,
.nav__link:focus-visible {
  color: var(--color-text);
}

.nav__link.router-link-active {
  border-bottom-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: 600;
}

.nav__toggle {
  display: none;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  cursor: pointer;
}

.nav__toggle::before {
  content: '';
  display: block;
  width: 18px;
  height: 2px;
  margin: 0 auto;
  background: var(--color-text);
  box-shadow:
    0 -6px 0 var(--color-text),
    0 6px 0 var(--color-text);
}

.nav__toggle:hover {
  border-color: var(--color-accent);
}

.nav__toggle:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

@media (max-width: 600px) {
  .nav {
    padding: calc(var(--space) / 2) 0;
  }

  .nav__toggle {
    display: block;
  }

  .nav__list {
    display: none;
    width: 100%;
    flex-direction: column;
    gap: 0;
    padding-top: calc(var(--space) / 2);
  }

  .nav__list--open {
    display: flex;
  }

  .nav__link {
    padding: 12px 4px;
    border-bottom: 1px solid var(--color-border);
  }

  .nav__link.router-link-active {
    border-bottom-color: var(--color-accent);
  }
}
</style>
