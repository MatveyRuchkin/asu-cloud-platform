<script setup lang="ts">
import { ref } from 'vue'

import LoginForm from './auth/LoginForm.vue'
import RegisterForm from './auth/RegisterForm.vue'
import type { AuthMode } from './auth/types'
import './auth/auth.css'

const mode = ref<AuthMode>('login')
const loginEmail = ref('')
const notice = ref('')

function showLogin() {
  mode.value = 'login'
}

function showRegister() {
  mode.value = 'register'
  notice.value = ''
}

// После успешной регистрации переключаемся на «Вход» и подставляем email.
function handleRegistered(email: string) {
  loginEmail.value = email
  notice.value = `Аккаунт ${email} создан. Войдите с этим email.`
  mode.value = 'login'
}
</script>

<template>
  <main class="auth">
    <h1 class="auth__title">Добро пожаловать</h1>
    <p class="auth__subtitle">Войдите или создайте аккаунт студента.</p>

    <div class="auth__tabs" role="tablist" aria-label="Вход и регистрация">
      <button
        id="tab-login"
        class="auth__tab"
        type="button"
        role="tab"
        :aria-selected="mode === 'login'"
        aria-controls="panel-login"
        @click="showLogin"
      >
        Вход
      </button>
      <button
        id="tab-register"
        class="auth__tab"
        type="button"
        role="tab"
        :aria-selected="mode === 'register'"
        aria-controls="panel-register"
        @click="showRegister"
      >
        Регистрация
      </button>
    </div>

    <p v-if="notice" class="auth-alert auth-alert--success" role="status">{{ notice }}</p>

    <div v-show="mode === 'login'" id="panel-login" role="tabpanel" aria-labelledby="tab-login">
      <LoginForm :initial-email="loginEmail" />
    </div>

    <div
      v-show="mode === 'register'"
      id="panel-register"
      role="tabpanel"
      aria-labelledby="tab-register"
    >
      <RegisterForm @registered="handleRegistered" />
    </div>
  </main>
</template>
