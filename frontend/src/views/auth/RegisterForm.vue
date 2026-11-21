<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { apiRequest } from '@/api/http'
import type { University } from '@/api/types'

import { authErrorMessage } from './errors'
import type { RegisterRequest } from './types'
import {
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUniversity,
} from './validation'

const emit = defineEmits<{ registered: [email: string] }>()

type ErrorField = 'displayName' | 'email' | 'universityId' | 'password'

const displayName = ref('')
const email = ref('')
const universityId = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const serverError = ref('')

const errors = reactive<Record<ErrorField, string | null>>({
  displayName: null,
  email: null,
  universityId: null,
  password: null,
})

const universities = ref<University[]>([])
const universitiesLoading = ref(false)
const universitiesError = ref('')

// Справочник вузов нужен, чтобы отправлять реальный UUID, а не вводить его руками.
async function loadUniversities() {
  universitiesLoading.value = true
  universitiesError.value = ''
  try {
    universities.value = await apiRequest<University[]>('/universities')
  } catch (error) {
    universitiesError.value = authErrorMessage(error)
  } finally {
    universitiesLoading.value = false
  }
}

onMounted(loadUniversities)

function clearError(field: ErrorField) {
  errors[field] = null
  serverError.value = ''
}

async function submit() {
  serverError.value = ''

  errors.displayName = validateDisplayName(displayName.value)
  errors.email = validateEmail(email.value)
  errors.universityId = validateUniversity(universityId.value)
  errors.password = validatePassword(password.value, 8)

  if (errors.displayName || errors.email || errors.universityId || errors.password) {
    return
  }

  // Поля запроса — ровно по схеме RegisterRequest из OpenAPI.
  const payload: RegisterRequest = {
    email: email.value.trim(),
    password: password.value,
    display_name: displayName.value.trim(),
    university_id: universityId.value,
  }

  submitting.value = true
  try {
    // Единственный способ вызова API — общий клиент src/api/http.ts.
    await apiRequest('/auth/register', { method: 'POST', body: payload })
    emit('registered', payload.email)
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

    <div class="auth-field">
      <label class="auth-field__label" for="register-name">Имя и фамилия</label>
      <input
        id="register-name"
        v-model="displayName"
        class="auth-field__input"
        :class="{ 'auth-field__input--invalid': errors.displayName }"
        type="text"
        name="display_name"
        autocomplete="name"
        placeholder="Адиля Юмина"
        :aria-invalid="Boolean(errors.displayName)"
        :aria-describedby="errors.displayName ? 'register-name-error' : undefined"
        @input="clearError('displayName')"
      />
      <p v-if="errors.displayName" id="register-name-error" class="auth-field__error">
        {{ errors.displayName }}
      </p>
    </div>

    <div class="auth-field">
      <label class="auth-field__label" for="register-email">Email</label>
      <input
        id="register-email"
        v-model="email"
        class="auth-field__input"
        :class="{ 'auth-field__input--invalid': errors.email }"
        type="email"
        name="email"
        autocomplete="email"
        placeholder="student@example.com"
        :aria-invalid="Boolean(errors.email)"
        :aria-describedby="errors.email ? 'register-email-error' : undefined"
        @input="clearError('email')"
      />
      <p v-if="errors.email" id="register-email-error" class="auth-field__error">
        {{ errors.email }}
      </p>
    </div>

    <div class="auth-field">
      <label class="auth-field__label" for="register-university">Университет</label>
      <select
        id="register-university"
        v-model="universityId"
        class="auth-field__select"
        :class="{ 'auth-field__select--invalid': errors.universityId }"
        name="university_id"
        :disabled="universitiesLoading"
        :aria-invalid="Boolean(errors.universityId)"
        :aria-describedby="errors.universityId ? 'register-university-error' : undefined"
        @change="clearError('universityId')"
      >
        <option value="">
          {{ universitiesLoading ? 'Загружаем список…' : 'Выберите университет' }}
        </option>
        <option v-for="university in universities" :key="university.id" :value="university.id">
          {{ university.name }}
        </option>
      </select>
      <p v-if="universitiesError" class="auth-field__error">
        {{ universitiesError }}
        <button class="auth-link" type="button" @click="loadUniversities">Повторить</button>
      </p>
      <p v-else-if="errors.universityId" id="register-university-error" class="auth-field__error">
        {{ errors.universityId }}
      </p>
    </div>

    <div class="auth-field">
      <label class="auth-field__label" for="register-password">Пароль</label>
      <div class="auth-field__control">
        <input
          id="register-password"
          v-model="password"
          class="auth-field__input auth-field__input--with-toggle"
          :class="{ 'auth-field__input--invalid': errors.password }"
          :type="showPassword ? 'text' : 'password'"
          name="password"
          autocomplete="new-password"
          placeholder="Не меньше 8 символов"
          :aria-invalid="Boolean(errors.password)"
          :aria-describedby="errors.password ? 'register-password-error' : undefined"
          @input="clearError('password')"
        />
        <button class="auth-field__toggle" type="button" @click="showPassword = !showPassword">
          {{ showPassword ? 'Скрыть' : 'Показать' }}
        </button>
      </div>
      <p class="auth-field__hint">Минимум 8 символов.</p>
      <p v-if="errors.password" id="register-password-error" class="auth-field__error">
        {{ errors.password }}
      </p>
    </div>

    <button class="auth-submit" type="submit" :disabled="submitting">
      {{ submitting ? 'Отправляем…' : 'Создать аккаунт' }}
    </button>
  </form>
</template>
