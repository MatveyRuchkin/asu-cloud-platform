/**
 * Единственная точка вызова API во frontend.
 *
 * Схема взаимодействия описана в docs/architecture/decisions.md (ADR-009):
 * компоненты не знают про базу и не пишут SQL — они обращаются к API через этот модуль.
 * Формат ошибки — `{code, message, details}` (контракт `docs/api/openapi.yaml`).
 */

import type { ApiErrorPayload } from './types'

const FALLBACK_BASE_URL = 'http://localhost:8000/api/v1'

/** Базовый адрес API: значение из `.env` (см. `.env.example`). */
export function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || FALLBACK_BASE_URL
}

/** Ошибка запроса к API с кодом и сообщением для пользователя. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.details = payload.details
  }
}

export interface ApiRequestOptions {
  /** Тело запроса: объект будет преобразован в JSON. */
  body?: unknown
  /** Токен доступа: подставляется в заголовок Authorization. */
  token?: string | null
  /** HTTP-метод. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Дополнительные заголовки. */
  headers?: Record<string, string>
}

/** Выполняет запрос к API и возвращает разобранный ответ. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, token, method = 'GET', headers, ...rest } = options

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...rest,
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function readError(response: Response): Promise<ApiErrorPayload> {
  try {
    const payload = (await response.json()) as Partial<ApiErrorPayload>
    if (typeof payload.code === 'string' && typeof payload.message === 'string') {
      return payload as ApiErrorPayload
    }
  } catch {
    // Тело ответа не является JSON — возвращаем общую ошибку ниже.
  }

  return {
    code: `http_${response.status}`,
    message: response.statusText || 'Ошибка запроса',
  }
}
