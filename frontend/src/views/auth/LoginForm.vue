<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import { apiRequest } from '@/api/http'

import { authErrorMessage } from './errors'
import type { LoginRequest } from './types'
import { validateEmail, validatePassword } from './validation'

const props = withDefaults(defineProps<{ initialEmail?: string }>(), {
  initialEmail: '',
})

const emit = defineEmits<{ success: [] }>()

const email = ref(props.initialEmail)
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const serverError = ref('')
const successMessage = ref('')

const errors = reactive<Record<'email' | 'password', string | null>>({
  email: null,
  password: null,
})

// После регистрации родитель передаёт email — подставляем его в форму входа.
watch(
  () => props.initialEmail,
  (value) => {
    if (value) {
      email.value = value
    }
  },
)

function clearError(field: 'email' | 'password') {
  errors[field] = null
  serverError.value = ''
  successMessage.value = ''
}

async function submit() {
  serverError.value = ''
  successMessage.value = ''

  errors.email = validateEmail(email.value)
  errors.password = validatePassword(password.value)
  if (errors.email || errors.password) {
    return
  }

  // Поля запроса — ровно по схеме LoginRequest из OpenAPI.
  const payload: LoginRequest = {
    email: email.value.trim(),
    password: password.value,
  }

  submitting.value = true
  try {
    // Единственный способ вызова API — общий клиент src/api/http.ts.
    await apiRequest('/auth/login', { method: 'POST', body: payload })
    successMessage.value = 'Вход выполнен.'
    emit('success')
  } catch (error) {
    serverError.value = authErrorMessage(error)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="auth-form" novalidate @submit.prevent="submit">
    <p v-if="serverError" class="auth-alert auth-alert--error" role="alert">{{ serverError }}</p>
    <p v-if="successMessage" class="auth-alert auth-alert--success" role="status">
      {{ successMessage }}
    </p>

    <div class="auth-field">
      <label class="auth-field__label" for="login-email">Email</label>
      <input
        id="login-email"
        v-model="email"
        class="auth-field__input"
        :class="{ 'auth-field__input--invalid': errors.email }"
        type="email"
        name="email"
        autocomplete="email"
        placeholder="student@example.com"
        :aria-invalid="Boolean(errors.email)"
        :aria-describedby="errors.email ? 'login-email-error' : undefined"
        @input="clearError('email')"
      />
      <p v-if="errors.email" id="login-email-error" class="auth-field__error">
        {{ errors.email }}
      </p>
    </div>

    <div class="auth-field">
      <label class="auth-field__label" for="login-password">Пароль</label>
      <div class="auth-field__control">
        <input
          id="login-password"
          v-model="password"
          class="auth-field__input auth-field__input--with-toggle"
          :class="{ 'auth-field__input--invalid': errors.password }"
          :type="showPassword ? 'text' : 'password'"
          name="password"
          autocomplete="current-password"
          placeholder="Ваш пароль"
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? 'login-password-error' : undefined"
          @input="clearError('password')"
        />
        <button class="auth-field__toggle" type="button" @click="showPassword = !showPassword">
          {{ showPassword ? 'Скрыть' : 'Показать' }}
        </button>
      </div>
      <p v-if="errors.password" id="login-password-error" class="auth-field__error">
        {{ errors.password }}
      </p>
    </div>

    <button class="auth-submit" type="submit" :disabled="submitting">
      {{ submitting ? 'Отправляем…' : 'Войти' }}
    </button>
  </form>
</template>
