import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import './styles/main.css'

// Точка входа frontend-приложения. Каркас создан по Issue #5 (ARCH-01).
createApp(App).use(createPinia()).use(router).mount('#app')
