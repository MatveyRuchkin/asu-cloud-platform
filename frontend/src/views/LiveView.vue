<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { apiRequest } from '@/api/http'
import type { Ad, AdCategory, ForumSection, ForumTopic, University, User } from '@/api/types'
import { accessToken, saveToken } from '@/stores/session'
import AdCreateView from './AdCreateView.vue'
import { authErrorMessage } from './auth/errors'

const route = useRoute()
const ads = ref<Ad[]>([])
const categories = ref<AdCategory[]>([])
const sections = ref<ForumSection[]>([])
const topics = ref<ForumTopic[]>([])
const universities = ref<University[]>([])
const profile = ref<User | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const search = ref('')
const category = ref('')
const section = ref('')
const showForm = ref(false)
let generation = 0

const filteredAds = computed(() =>
  ads.value.filter(
    (ad) =>
      (!category.value || ad.category_id === category.value) &&
      `${ad.title} ${ad.description}`.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
)
const filteredTopics = computed(() =>
  topics.value.filter((topic) => !section.value || topic.section_id === section.value),
)
function categoryName(id: string) {
  return categories.value.find((item) => item.id === id)?.name ?? 'Категория'
}
function sectionName(id: string) {
  return sections.value.find((item) => item.id === id)?.name ?? 'Раздел'
}
const universityName = computed(
  () =>
    universities.value.find((item) => item.id === profile.value?.university_id)?.name ??
    'Университет',
)

async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  ads.value = []
  topics.value = []
  profile.value = null
  try {
    if (route.name === 'ads') {
      const data = await Promise.all([
        apiRequest<Ad[]>('/ads'),
        apiRequest<AdCategory[]>('/ad-categories'),
      ])
      if (current !== generation) return
      ads.value = data[0]
      categories.value = data[1]
    } else if (route.name === 'forum') {
      const data = await Promise.all([
        apiRequest<ForumSection[]>('/forum/sections'),
        apiRequest<ForumTopic[]>('/forum/topics'),
      ])
      if (current !== generation) return
      sections.value = data[0]
      topics.value = data[1]
    } else if (accessToken.value) {
      const data = await Promise.all([
        apiRequest<User>('/users/me'),
        apiRequest<University[]>('/universities'),
      ])
      if (current !== generation) return
      profile.value = data[0]
      universities.value = data[1]
    }
  } catch (cause) {
    if (current === generation) error.value = authErrorMessage(cause)
  } finally {
    if (current === generation) loading.value = false
  }
}

async function created() {
  showForm.value = false
  category.value = ''
  search.value = ''
  notice.value = 'Объявление сохранено на сервере.'
  await load()
}

watch(
  [() => route.name, accessToken],
  () => {
    showForm.value = false
    notice.value = ''
    void load()
  },
  { immediate: true },
)
</script>

<template>
  <div class="live-page">
    <section class="campus-hero">
      <span class="campus-eyebrow">СТУДЕНЧЕСКАЯ ПЛАТФОРМА</span>
      <h1>Всё, что объединяет студентов</h1>
      <p>Находите полезные вещи, обсуждайте учёбу и знакомьтесь с людьми из своего кампуса.</p>
      <div class="campus-shortcuts">
        <RouterLink to="/ads">Объявления</RouterLink><RouterLink to="/forum">Обсуждения</RouterLink
        ><RouterLink :to="accessToken ? '/profile' : '/login'">{{
          accessToken ? 'Мой профиль' : 'Войти'
        }}</RouterLink>
      </div>
    </section>
    <p v-if="loading" role="status">Загружаем данные…</p>
    <div v-if="error" class="api-error" role="alert">
      <p>{{ error }}</p>
      <button class="primary-action" type="button" @click="load">Повторить</button>
    </div>
    <p v-if="notice" class="example-notice" role="status">{{ notice }}</p>

    <section v-if="route.name === 'ads'" aria-labelledby="ads-heading">
      <div class="section-heading">
        <div>
          <p class="section-kicker">ДОСКА КАМПУСА</p>
          <h2 id="ads-heading">Объявления</h2>
        </div>
        <button
          v-if="accessToken"
          class="primary-action"
          type="button"
          :aria-expanded="showForm"
          @click="showForm = !showForm"
        >
          {{ showForm ? 'Закрыть форму' : 'Создать объявление' }}</button
        ><RouterLink v-else class="primary-action" to="/login"
          >Войти и создать объявление</RouterLink
        >
      </div>
      <AdCreateView
        v-if="showForm && accessToken"
        :categories="categories"
        :access-token="accessToken"
        @created="created"
      />
      <div class="ads-toolbar">
        <label class="search-label" for="ad-category"
          >Категория<select id="ad-category" v-model="category">
            <option value="">Все категории</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select></label
        ><label class="search-label" for="ad-search"
          >Поиск объявлений<input
            id="ad-search"
            v-model="search"
            type="search"
            placeholder="Что ищете?" /></label
        ><button type="button" class="primary-action" :disabled="loading" @click="load">
          Обновить
        </button>
      </div>
      <div v-if="!error" class="ad-grid">
        <article v-for="ad in filteredAds" :key="ad.id" class="ad-card">
          <div class="ad-art ad-art--blue" aria-hidden="true">
            {{ ad.title.slice(0, 2).toUpperCase() }}
          </div>
          <div class="ad-body">
            <span class="category-label">{{ categoryName(ad.category_id) }}</span>
            <h3>{{ ad.title }}</h3>
            <p>{{ ad.description }}</p>
            <div class="ad-footer">
              <strong>{{
                ad.price_rub == null
                  ? 'Цена не указана'
                  : ad.price_rub === 0
                    ? 'Бесплатно'
                    : `${ad.price_rub.toLocaleString('ru-RU')} ₽`
              }}</strong
              ><span>{{ ad.status === 'closed' ? 'Закрыто' : 'Активно' }}</span>
            </div>
          </div>
        </article>
      </div>
      <p v-if="!loading && !error && !filteredAds.length" class="empty-results">
        Объявления не найдены. Измените фильтры или создайте первое объявление.
      </p>
    </section>

    <section v-else-if="route.name === 'forum'" aria-labelledby="forum-heading">
      <div class="section-heading">
        <h2 id="forum-heading">Форум сообщества</h2>
        <button class="primary-action" type="button" :disabled="loading" @click="load">
          Обновить
        </button>
      </div>
      <label class="search-label" for="forum-section"
        >Раздел<select id="forum-section" v-model="section">
          <option value="">Все разделы</option>
          <option v-for="item in sections" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select></label
      >
      <div v-if="!error" class="topic-list">
        <article v-for="topic in filteredTopics" :key="topic.id" class="topic-card">
          <span class="category-label">{{ sectionName(topic.section_id) }}</span>
          <h3>{{ topic.title }}</h3>
        </article>
      </div>
      <p v-if="!loading && !error && !filteredTopics.length" class="empty-results">
        В этом разделе пока нет тем.
      </p>
      <p class="page__hint">Публикация тем и ответов пока недоступна.</p>
    </section>

    <section v-else aria-labelledby="profile-heading">
      <div class="section-heading">
        <h2 id="profile-heading">Мой профиль</h2>
        <button v-if="accessToken" class="primary-action" type="button" @click="saveToken(null)">
          Выйти
        </button>
      </div>
      <article v-if="profile" class="profile-card">
        <div class="profile-avatar" aria-hidden="true">
          {{ profile.display_name.slice(0, 2).toUpperCase() }}
        </div>
        <h3>{{ profile.display_name }}</h3>
        <p>{{ universityName }}</p>
        <p v-if="profile.faculty">{{ profile.faculty }}</p>
        <p v-if="profile.course">Курс: {{ profile.course }}</p>
      </article>
      <p v-else-if="!loading && !accessToken">
        Для просмотра профиля <RouterLink to="/login">войдите в аккаунт</RouterLink>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.live-page {
  display: grid;
  gap: 24px;
}
.campus-hero {
  padding: 42px;
  border-radius: 20px;
  color: white;
  background: linear-gradient(120deg, #183b8c, #355ed8);
}
.campus-eyebrow,
.section-kicker {
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}
.campus-eyebrow {
  color: #cbdcff;
}
.campus-hero h1 {
  max-width: 640px;
  margin: 14px 0;
  font-size: clamp(2rem, 5vw, 3.2rem);
  line-height: 1.12;
  letter-spacing: -0.035em;
}
.campus-hero p {
  max-width: 620px;
  color: #e0e9ff;
  font-size: 1.0625rem;
}
.campus-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}
.campus-shortcuts a {
  padding: 10px 17px;
  border: 1px solid #ffffff66;
  border-radius: 8px;
  color: white;
  text-decoration: none;
}
.campus-shortcuts a:hover {
  background: #ffffff20;
}
.demo-notice {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid #d9e2f5;
  border-radius: 10px;
  background: #edf3ff;
  color: #284675;
}
.section-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}
.section-kicker {
  margin: 0 0 6px;
  color: #64748b;
}
.section-heading h2 {
  margin: 0;
  font-size: 1.8rem;
  letter-spacing: -0.025em;
}
.primary-action {
  display: inline-block;
  border: 0;
  border-radius: 9px;
  padding: 12px 18px;
  background: #2455c7;
  color: white;
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.primary-action:hover {
  background: #1945ad;
}
.ads-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 22px;
}
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.category-tabs button {
  border: 1px solid #dce2ea;
  border-radius: 24px;
  background: white;
  padding: 9px 16px;
  font: inherit;
  cursor: pointer;
}
.category-tabs .selected {
  background: #e6edff;
  border-color: #9eb6f5;
  color: #1945ad;
}
.search-label {
  display: grid;
  gap: 5px;
  font-size: 0.875rem;
}
input,
select,
textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  background: white;
  color: #1f2933;
  font: inherit;
  font-size: 1rem;
}
.ad-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.ad-card,
.topic-card,
.profile-card {
  background: white;
  border: 1px solid #e0e6ef;
  border-radius: 14px;
  overflow: hidden;
}
.ad-art {
  display: grid;
  place-items: center;
  height: 150px;
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.08em;
}
.ad-art--blue {
  background: #dce7ff;
  color: #4871c5;
}
.ad-art--purple {
  background: #ece2ff;
  color: #8560bc;
}
.ad-art--green {
  background: #dff0e7;
  color: #398363;
}
.ad-body {
  padding: 20px;
}
.category-label {
  display: inline-block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #345ec0;
}
.ad-body h3 {
  margin: 10px 0;
  font-size: 1.15rem;
}
.ad-body p,
.topic-card p,
.profile-card p {
  color: #596779;
}
.ad-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  align-items: center;
  margin-top: 24px;
}
.ad-footer strong {
  font-size: 1.1rem;
}
.ad-footer span,
.topic-meta,
.section-count {
  color: #64748b;
  font-size: 0.875rem;
}
.example-form {
  display: grid;
  gap: 16px;
  max-width: 640px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  background: white;
}
.example-form h3,
.example-form p {
  margin: 0;
}
.example-form label {
  display: grid;
  gap: 6px;
}
.example-notice {
  padding: 12px 16px;
  border-radius: 8px;
  color: #23543e;
  background: #e2f3e9;
}
.empty-results {
  padding: 30px;
  text-align: center;
  background: white;
  border-radius: 12px;
}
.topic-list {
  display: grid;
  gap: 16px;
}
.topic-card {
  padding: 24px;
}
.topic-title {
  display: block;
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-weight: 700;
  font-size: 1.2rem;
  color: #183b8c;
  text-align: left;
  cursor: pointer;
}
.topic-detail {
  margin-top: 18px;
  padding: 18px;
  border-radius: 10px;
  background: #f2f5fa;
}
.profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.profile-card {
  padding: 28px;
}
.profile-avatar {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: #e0e9ff;
  color: #345ec0;
  font-size: 1.5rem;
  font-weight: 700;
}
.profile-features {
  padding: 0;
  list-style: none;
}
.profile-features li {
  display: grid;
  gap: 4px;
  padding: 18px 0;
  border-bottom: 1px solid #e5e7eb;
}
.profile-features span {
  color: #596779;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: 3px solid #80a6ff;
  outline-offset: 3px;
}
@media (max-width: 850px) {
  .ad-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .campus-hero {
    padding: 28px 22px;
  }
  .ad-grid,
  .profile-grid {
    grid-template-columns: 1fr;
  }
  .search-label {
    width: 100%;
  }
  .campus-shortcuts a {
    padding: 9px 12px;
  }
}
</style>
