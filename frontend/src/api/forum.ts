/** Вызовы API форума. Контракт: docs/api/openapi.yaml, `GET /forum/sections`. */

import { apiRequest } from './http'
import type { ForumSection } from './types'

/** Получить список разделов форума. */
export function fetchForumSections(): Promise<ForumSection[]> {
  return apiRequest<ForumSection[]>('/forum/sections')
}
