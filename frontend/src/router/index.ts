import { createRouter, createWebHistory } from 'vue-router'

import PlaceholderView from '@/views/PlaceholderView.vue'

// Маршруты каркаса. Содержимое страниц — задача FE-02…FE-04, владелец каркаса — FE-01.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/login' },
    {
      path: '/login',
      name: 'login',
      component: PlaceholderView,
      meta: { title: 'Вход и регистрация' },
    },
    {
      path: '/ads',
      name: 'ads',
      component: PlaceholderView,
      meta: { title: 'Объявления' },
    },
    {
      path: '/forum',
      name: 'forum',
      component: PlaceholderView,
      meta: { title: 'Форум' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: PlaceholderView,
      meta: { title: 'Профиль' },
    },
  ],
})

export default router
