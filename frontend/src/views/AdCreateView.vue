<script setup lang="ts">
import { reactive, ref } from 'vue'

import { ApiError, apiRequest } from '@/api/http'
import type { Ad, AdCreate } from '@/api/types'

/**
 * Категории передаются странице извне.
 * Настоящие UUID мы не придумываем.
 */
interface CategoryOption {
  id: string
  name: string
}

const props = withDefaults(
  defineProps<{
    categories?: CategoryOption[]
    accessToken?: string | null
  }>(),
  {
    categories: () => [],
    accessToken: null,
  },
)

const emit = defineEmits<{
  created: [ad: Ad]
}>()

type FieldName = 'category_id' | 'title' | 'description' | 'price_rub' | 'image_url'

const form = reactive({
  category_id: '',
  title: '',
  description: '',
  price_rub: '',
  image_url: '',
})

const errors = reactive<Partial<Record<FieldName, string>>>({})

const isSubmitting = ref(false)
const serverError = ref('')
const successMessage = ref('')

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clearErrors() {
  for (const field of Object.keys(errors) as FieldName[]) {
    delete errors[field]
  }
}

function resetForm() {
  form.category_id = ''
  form.title = ''
  form.description = ''
  form.price_rub = ''
  form.image_url = ''

  clearErrors()
}

function validateForm(): boolean {
  clearErrors()
  serverError.value = ''
  successMessage.value = ''

  // Проверяем, что выбрана настоящая категория.
  const selectedCategory = props.categories.find((category) => category.id === form.category_id)

  if (!props.categories.length) {
    errors.category_id = 'Список категорий пока недоступен.'
  } else if (!selectedCategory || !UUID_PATTERN.test(form.category_id)) {
    errors.category_id = 'Выберите корректную категорию.'
  }

  // Заголовок должен содержать минимум 3 символа.
  if (form.title.trim().length < 3) {
    errors.title = 'Заголовок должен содержать минимум 3 символа.'
  }

  // Описание обязательно.
  if (form.description.trim().length < 1) {
    errors.description = 'Введите описание объявления.'
  }

  // Цена — целое неотрицательное число или null.
  const price = form.price_rub.trim()

  if (price !== '') {
    const numericPrice = Number(price)

    if (!/^\d+$/.test(price) || !Number.isSafeInteger(numericPrice) || numericPrice < 0) {
      errors.price_rub = 'Введите целое число от 0 или оставьте поле пустым.'
    }
  }

  // Фото должна иметь корректную веб-ссылку или быть пустой.
  const imageUrl = form.image_url.trim()

  if (imageUrl !== '') {
    try {
      const parsedUrl = new URL(imageUrl)

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        errors.image_url = 'Ссылка должна начинаться с http:// или https://.'
      }
    } catch {
      errors.image_url = 'Введите корректную ссылку на фотографию.'
    }
  }

  return Object.keys(errors).length === 0
}

async function submitForm() {
  if (isSubmitting.value || !validateForm()) {
    return
  }

  serverError.value = ''

  // Токен должен передаваться механизмом авторизации.
  if (!props.accessToken) {
    serverError.value = 'Для создания объявления необходимо войти в систему.'
    return
  }

  const payload: AdCreate = {
    category_id: form.category_id,
    title: form.title.trim(),
    description: form.description.trim(),
    price_rub: form.price_rub.trim() === '' ? null : Number(form.price_rub),
    image_url: form.image_url.trim() === '' ? null : form.image_url.trim(),
  }

  isSubmitting.value = true

  try {
    const createdAd = await apiRequest<Ad>('/ads', {
      method: 'POST',
      body: payload,
      token: props.accessToken,
    })

    successMessage.value = 'Объявление успешно создано.'

    resetForm()

    emit('created', createdAd)
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      serverError.value = error.message
    } else {
      serverError.value =
        'Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="page ad-create">
    <header class="ad-create__header">
      <h1 class="page__title">Создать объявление</h1>
      <p class="ad-create__subtitle">Заполните информацию о своём предложении.</p>
    </header>

    <div v-if="!props.categories.length" class="form-notice">
      Список категорий пока не подключён. Форма станет доступна после получения настоящих категорий
      от приложения.
    </div>

    <div v-if="!props.accessToken" class="form-notice">
      Для отправки объявления потребуется авторизация в приложении.
    </div>

    <form class="ad-form" novalidate @submit.prevent="submitForm">
      <!-- Категория -->
      <div class="form-field">
        <label for="category-id" class="form-field__label">
          Категория <span class="required">*</span>
        </label>

        <select
          id="category-id"
          v-model="form.category_id"
          class="form-field__input"
          :class="{ 'form-field__input--error': errors.category_id }"
          required
          :aria-invalid="Boolean(errors.category_id)"
        >
          <option value="" disabled>Выберите категорию</option>

          <option v-for="category in props.categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>

        <p v-if="errors.category_id" class="form-field__error">
          {{ errors.category_id }}
        </p>
      </div>

      <!-- Заголовок -->
      <div class="form-field">
        <label for="ad-title" class="form-field__label">
          Заголовок <span class="required">*</span>
        </label>

        <input
          id="ad-title"
          v-model="form.title"
          class="form-field__input"
          :class="{ 'form-field__input--error': errors.title }"
          type="text"
          placeholder="Например, продам учебник по математике"
          required
          :aria-invalid="Boolean(errors.title)"
        />

        <p v-if="errors.title" class="form-field__error">
          {{ errors.title }}
        </p>
      </div>

      <!-- Описание -->
      <div class="form-field">
        <label for="ad-description" class="form-field__label">
          Описание <span class="required">*</span>
        </label>

        <textarea
          id="ad-description"
          v-model="form.description"
          class="form-field__input form-field__textarea"
          :class="{ 'form-field__input--error': errors.description }"
          placeholder="Расскажите подробнее о предложении..."
          rows="5"
          required
          :aria-invalid="Boolean(errors.description)"
        />

        <p v-if="errors.description" class="form-field__error">
          {{ errors.description }}
        </p>
      </div>

      <!-- Цена -->
      <div class="form-field">
        <label for="ad-price" class="form-field__label"> Цена, ₽ </label>

        <input
          id="ad-price"
          v-model="form.price_rub"
          class="form-field__input"
          :class="{ 'form-field__input--error': errors.price_rub }"
          type="text"
          inputmode="numeric"
          placeholder="Например, 500"
          :aria-invalid="Boolean(errors.price_rub)"
        />

        <small class="form-field__hint"> Необязательно. Целое число или пустое значение. </small>

        <p v-if="errors.price_rub" class="form-field__error">
          {{ errors.price_rub }}
        </p>
      </div>

      <!-- Ссылка на фотографию -->
      <div class="form-field">
        <label for="ad-image-url" class="form-field__label"> Ссылка на фотографию </label>

        <input
          id="ad-image-url"
          v-model="form.image_url"
          class="form-field__input"
          :class="{ 'form-field__input--error': errors.image_url }"
          type="url"
          placeholder="https://example.com/photo.jpg"
          :aria-invalid="Boolean(errors.image_url)"
        />

        <small class="form-field__hint"> Необязательно. Укажите ссылку на изображение. </small>

        <p v-if="errors.image_url" class="form-field__error">
          {{ errors.image_url }}
        </p>
      </div>

      <!-- Сообщения -->
      <p v-if="serverError" class="form-message form-message--error" role="alert">
        {{ serverError }}
      </p>

      <p v-if="successMessage" class="form-message form-message--success" role="status">
        {{ successMessage }}
      </p>

      <button class="ad-form__submit" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Отправка...' : 'Создать объявление' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.ad-create {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.ad-create__header {
  margin-bottom: 28px;
}

.ad-create__subtitle {
  margin: -8px 0 0;
  color: var(--color-muted, #6b7280);
}

.ad-form {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.form-field__label {
  font-size: 15px;
  font-weight: 600;
}

.required {
  color: #dc2626;
}

.form-field__input {
  width: 100%;
  min-height: 46px;
  padding: 11px 13px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius, 8px);
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #1f2933);
  font: inherit;
  font-size: 16px;
}

.form-field__input:focus {
  outline: 2px solid var(--color-accent, #2563eb);
  outline-offset: 2px;
}

.form-field__input--error {
  border-color: #dc2626;
}

.form-field__textarea {
  min-height: 120px;
  resize: vertical;
}

.form-field__hint {
  color: var(--color-muted, #6b7280);
  font-size: 13px;
}

.form-field__error {
  margin: 0;
  color: #dc2626;
  font-size: 13px;
}

.form-notice {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1px solid #fcd34d;
  border-radius: var(--radius, 8px);
  background: #fffbeb;
  color: #92400e;
  font-size: 14px;
}

.form-message {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius, 8px);
  font-size: 14px;
}

.form-message--error {
  background: #fef2f2;
  color: #b91c1c;
}

.form-message--success {
  background: #f0fdf4;
  color: #166534;
}

.ad-form__submit {
  width: 100%;
  min-height: 48px;
  padding: 12px 18px;
  border: 0;
  border-radius: var(--radius, 8px);
  background: var(--color-accent, #2563eb);
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.ad-form__submit:hover:not(:disabled) {
  opacity: 0.9;
}

.ad-form__submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 600px) {
  .ad-form {
    gap: 18px;
  }

  .form-field__input {
    min-height: 48px;
  }
}
</style>
