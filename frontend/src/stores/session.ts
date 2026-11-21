import { ref } from 'vue'

const key = 'asu-access-token'
function readToken(): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
export const accessToken = ref<string | null>(readToken())

export function saveToken(token: string | null) {
  accessToken.value = token
  try {
    if (token) sessionStorage.setItem(key, token)
    else sessionStorage.removeItem(key)
  } catch {
    /* The current tab still keeps its in-memory session. */
  }
}
