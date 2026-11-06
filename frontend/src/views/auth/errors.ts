import { ApiError } from '@/api/http'

/**
 * Превращает ошибку запроса в понятный текст для пользователя.
 *
 * Сервер присылает `{code, message, details}` (схема `Error` в OpenAPI) —
 * показываем `message`. Если сервер недоступен, `fetch` бросает не `ApiError`,
 * поэтому для такого случая есть отдельное сообщение.
 */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.'
}
