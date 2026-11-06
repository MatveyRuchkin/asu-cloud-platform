/**
 * Типы запросов авторизации.
 *
 * Повторяют схемы `LoginRequest` и `RegisterRequest` из `docs/api/openapi.yaml`:
 * имена полей — snake_case, значения — строки.
 *
 * Лежат рядом со страницей, потому что общий `src/api/types.ts` принадлежит
 * FE-01 и API-01 (ADR-008). При согласовании типы можно перенести туда.
 */

/** Тело запроса `POST /api/v1/auth/login`. */
export interface LoginRequest {
  email: string
  password: string
}

/** Тело запроса `POST /api/v1/auth/register`. */
export interface RegisterRequest {
  email: string
  password: string
  display_name: string
  university_id: string
}

/** Вкладка на странице входа и регистрации. */
export type AuthMode = 'login' | 'register'
