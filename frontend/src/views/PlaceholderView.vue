<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const search = ref('')
const category = ref('Все')
const categories = ['Все', 'Учебники', 'Техника', 'Услуги']
const showForm = ref(false)
const notice = ref('')
const draft = ref({ title: '', description: '', category: 'Учебники', price: '' })
const ads = ref([
  {
    id: 1,
    category: 'Учебники',
    title: 'Учебники для первого курса',
    description: 'Математика и информатика. Хорошее состояние, есть полезные заметки.',
    price: 500,
    initials: 'КН',
    tint: 'blue',
  },
  {
    id: 2,
    category: 'Техника',
    title: 'Настольная лампа для учёбы',
    description:
      'Три режима света и удобная подставка. Пример объявления для знакомства с платформой.',
    price: 800,
    initials: 'СВ',
    tint: 'purple',
  },
  {
    id: 3,
    category: 'Услуги',
    title: 'Разбираем задачи вместе',
    description: 'Собираем небольшую учебную группу: готовимся к зачёту и помогаем друг другу.',
    price: 0,
    initials: 'УЧ',
    tint: 'green',
  },
])
const filteredAds = computed(() =>
  ads.value.filter(
    (ad) =>
      (category.value === 'Все' || ad.category === category.value) &&
      `${ad.title} ${ad.description}`.toLowerCase().includes(search.value.toLowerCase().trim()),
  ),
)
const topics = [
  {
    id: 1,
    tag: 'Учёба',
    title: 'Как подготовиться к первой сессии?',
    description: 'Делимся планами подготовки, полезными материалами и советами.',
    replies: 8,
    detail:
      'Начните с перечня тем и распределите подготовку по дням. Здесь показан пример обсуждения; настоящие сообщения пока не публикуются.',
  },
  {
    id: 2,
    tag: 'Кампус',
    title: 'Ищем команду для учебного проекта',
    description: 'Познакомимся с теми, кто хочет попробовать разработку вместе.',
    replies: 4,
    detail:
      'В команде пригодятся разработчики, дизайнеры и тестировщики. Это демонстрационная тема для знакомства с будущим форумом.',
  },
  {
    id: 3,
    tag: 'Общение',
    title: 'Куда сходить после занятий?',
    description: 'Места для встреч, студенческие события и новые знакомства.',
    replies: 12,
    detail:
      'В этом разделе можно будет обсуждать события и договариваться о встречах. Сейчас он показывает примеры тем.',
  },
]
const openTopic = ref<number | null>(null)

function addExample() {
  const value = draft.value
  if (value.title.trim().length < 3 || !value.description.trim()) return
  const price = value.price === '' ? 0 : Number(value.price)
  if (!Number.isSafeInteger(price) || price < 0) return
  ads.value.unshift({
    id: Date.now(),
    category: value.category,
    title: value.title.trim(),
    description: value.description.trim(),
    price,
    initials: 'МО',
    tint: 'blue',
  })
  search.value = ''
  category.value = 'Все'
  showForm.value = false
  draft.value = { title: '', description: '', category: 'Учебники', price: '' }
  notice.value =
    'Пример добавлен на эту страницу. После перезагрузки он исчезнет; в общую базу он не отправляется.'
}
</script>

<template>
  <div class="demo-page">
    <section class="campus-hero">
      <span class="campus-eyebrow">СТУДЕНЧЕСКАЯ ПЛАТФОРМА</span>
      <h1>Всё, что объединяет студентов</h1>
      <p>Находите полезные вещи, обсуждайте учёбу и знакомьтесь с людьми из своего кампуса.</p>
      <div class="campus-shortcuts">
        <RouterLink to="/ads">Объявления</RouterLink>
        <RouterLink to="/forum">Обсуждения</RouterLink>
        <RouterLink to="/login">Присоединиться</RouterLink>
      </div>
    </section>

    <p class="demo-notice">
      Демонстрационная версия: объявления, темы и профиль ниже — вымышленные примеры.
    </p>

    <section v-if="route.name === 'ads'" class="demo-section" aria-labelledby="ads-heading">
      <div class="section-heading">
        <div>
          <p class="section-kicker">ДОСКА КАМПУСА</p>
          <h2 id="ads-heading">Объявления</h2>
        </div>
        <button
          class="primary-action"
          type="button"
          :aria-expanded="showForm"
          @click="showForm = !showForm"
        >
          {{ showForm ? 'Закрыть форму' : 'Добавить пример' }}
        </button>
      </div>
      <form v-if="showForm" class="example-form" @submit.prevent="addExample">
        <h3>Новое демо-объявление</h3>
        <p>Попробуйте форму. Этот пример останется только до перезагрузки страницы.</p>
        <label for="example-title"
          >Заголовок<input
            id="example-title"
            v-model="draft.title"
            required
            minlength="3"
            maxlength="120"
        /></label>
        <label for="example-category"
          >Категория<select id="example-category" v-model="draft.category">
            <option v-for="item in categories.slice(1)" :key="item">{{ item }}</option>
          </select></label
        >
        <label for="example-description"
          >Описание<textarea
            id="example-description"
            v-model="draft.description"
            required
            maxlength="1000"
            rows="3"
          ></textarea>
        </label>
        <label for="example-price"
          >Цена, ₽<input
            id="example-price"
            v-model="draft.price"
            type="number"
            min="0"
            step="1"
            placeholder="0 — бесплатно"
        /></label>
        <button class="primary-action" type="submit">Добавить на страницу</button>
      </form>
      <p v-if="notice" class="example-notice" role="status">{{ notice }}</p>
      <div class="ads-toolbar">
        <div class="category-tabs" aria-label="Категории">
          <button
            v-for="item in categories"
            :key="item"
            type="button"
            :aria-pressed="category === item"
            :class="{ selected: category === item }"
            @click="category = item"
          >
            {{ item }}
          </button>
        </div>
        <label class="search-label" for="ad-search"
          ><span>Поиск объявлений</span
          ><input id="ad-search" v-model="search" type="search" placeholder="Что ищете?"
        /></label>
      </div>
      <div class="ad-grid">
        <article v-for="ad in filteredAds" :key="ad.id" class="ad-card">
          <div class="ad-art" :class="`ad-art--${ad.tint}`" aria-hidden="true">
            {{ ad.initials }}
          </div>
          <div class="ad-body">
            <span class="category-label">{{ ad.category }}</span>
            <h3>{{ ad.title }}</h3>
            <p>{{ ad.description }}</p>
            <div class="ad-footer">
              <strong>{{
                ad.price === 0 ? 'Бесплатно' : `${ad.price.toLocaleString('ru-RU')} ₽`
              }}</strong
              ><span>Демо-пример</span>
            </div>
          </div>
        </article>
      </div>
      <p v-if="!filteredAds.length" class="empty-results" role="status">
        Ничего не найдено. Попробуйте другую категорию или измените запрос.
      </p>
    </section>

    <section
      v-else-if="route.name === 'forum'"
      class="demo-section"
      aria-labelledby="forum-heading"
    >
      <div class="section-heading">
        <div>
          <p class="section-kicker">ЕСТЬ ЧТО ОБСУДИТЬ</p>
          <h2 id="forum-heading">Форум сообщества</h2>
        </div>
        <span class="section-count">3 демо-темы</span>
      </div>
      <div class="topic-list">
        <article v-for="topic in topics" :key="topic.id" class="topic-card">
          <span class="category-label">{{ topic.tag }}</span
          ><button
            class="topic-title"
            type="button"
            :aria-expanded="openTopic === topic.id"
            :aria-controls="`topic-${topic.id}`"
            @click="openTopic = openTopic === topic.id ? null : topic.id"
          >
            {{ topic.title }}
          </button>
          <p>{{ topic.description }}</p>
          <span class="topic-meta">{{ topic.replies }} ответов · Пример обсуждения</span>
          <div v-if="openTopic === topic.id" :id="`topic-${topic.id}`" class="topic-detail">
            {{ topic.detail }}
          </div>
        </article>
      </div>
    </section>

    <section v-else class="demo-section" aria-labelledby="profile-heading">
      <div class="section-heading">
        <div>
          <p class="section-kicker">ЛИЧНОЕ ПРОСТРАНСТВО</p>
          <h2 id="profile-heading">Пример профиля</h2>
        </div>
      </div>
      <div class="profile-grid">
        <article class="profile-card">
          <div class="profile-avatar" aria-hidden="true">ДС</div>
          <h3>Демо-студент</h3>
          <p>Учебный кампус · 2 курс</p>
          <span class="category-label">Вымышленный профиль</span>
          <p>Здесь появятся ваши данные и активность после подключения личного кабинета.</p>
          <RouterLink class="primary-action" to="/login">Вход и регистрация</RouterLink>
        </article>
        <article class="profile-card">
          <h3>Ваша жизнь на платформе</h3>
          <ul class="profile-features">
            <li><strong>Объявления</strong><span>Вещи, учебники и помощь в учёбе</span></li>
            <li><strong>Обсуждения</strong><span>Ответы, идеи и полезные знакомства</span></li>
            <li><strong>Ваш университет</strong><span>Сообщество рядом с вами</span></li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-page {
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
