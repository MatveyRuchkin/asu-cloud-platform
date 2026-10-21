/**
 * Типы запросов и ответов API.
 *
 * Они повторяют схемы из `docs/api/openapi.yaml` один в один:
 * имена полей — snake_case, идентификаторы — UUID в строке, даты — ISO 8601 UTC.
 * При изменении контракта типы меняются в том же PR.
 */

/** Ошибка API: формат зафиксирован в контракте (схема `Error`). */
export interface ApiErrorPayload {
  code: string
  message: string
  details?: Record<string, unknown>
}

/** Ответ `GET /api/v1/health`. */
export interface HealthResponse {
  status: string
}

/** Токен доступа: ответ `POST /api/v1/auth/login`. */
export interface Token {
  access_token: string
  token_type: string
}

/** Университет: элемент `GET /api/v1/universities`. */
export interface University {
  id: string
  name: string
}

/** Профиль пользователя: ответ `GET /api/v1/users/me`. */
export interface User {
  id: string
  display_name: string
  university_id: string
  faculty?: string | null
  course?: number | null
}

/** Данные для создания объявления. */
export interface AdCreate {
  category_id: string
  title: string
  description: string
  price_rub?: number | null
  image_url?: string | null
}

/** Объявление: элемент `GET /api/v1/ads`. */
export interface Ad extends AdCreate {
  id: string
  author_id: string
  university_id: string
  status: 'active' | 'closed'
}

/** Раздел форума: элемент `GET /api/v1/forum/sections`. */
export interface ForumSection {
  id: string
  name: string
  description?: string | null
}

/** Тема форума: элемент `GET /api/v1/forum/topics`. */
export interface ForumTopic {
  id: string
  section_id: string
  title: string
  author_id: string
}
