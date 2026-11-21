import { createRouter, createWebHistory } from 'vue-router'

import AuthView from '@/views/AuthView.vue'
import LiveView from '@/views/LiveView.vue'

// Маршруты каркаса. Содержимое страниц — задача FE-02…FE-04, владелец каркаса — FE-01.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/ads' },
    {
      path: '/login',
      name: 'login',
      component: AuthView,
      meta: { title: 'Вход и регистрация' },
    },
    {
      path: '/ads',
      name: 'ads',
      component: LiveView,
      meta: { title: 'Объявления' },
    },
    {
      path: '/forum',
      name: 'forum',
      component: LiveView,
      meta: { title: 'Форум' },
    },
    {
      path: '/profile',
      name: 'profile',
      component: LiveView,
      meta: { title: 'Профиль' },
    },
  ],
})

export default router
