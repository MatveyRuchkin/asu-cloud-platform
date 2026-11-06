/**
 * Проверки полей формы входа и регистрации.
 *
 * Правила взяты из OpenAPI: email — формат email, пароль при регистрации —
 * не короче 8 символов, display_name — не короче 2 символов, university_id — обязателен.
 * Функции возвращают текст ошибки или `null`, если поле заполнено верно.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Проверяет email. */
export function validateEmail(value: string): string | null {
  const email = value.trim()
  if (!email) {
    return 'Введите email'
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Похоже, в email есть ошибка'
  }
  return null
}

/** Проверяет пароль: обязателен, при регистрации — не короче 8 символов. */
export function validatePassword(value: string, minLength = 1): string | null {
  if (!value) {
    return 'Введите пароль'
  }
  if (value.length < minLength) {
    return `Пароль должен быть не короче ${minLength} символов`
  }
  return null
}

/** Проверяет отображаемое имя: обязательное, не короче 2 символов. */
export function validateDisplayName(value: string): string | null {
  const name = value.trim()
  if (!name) {
    return 'Введите имя и фамилию'
  }
  if (name.length < 2) {
    return 'Имя должно быть не короче 2 символов'
  }
  return null
}

/** Проверяет, что университет выбран. */
export function validateUniversity(value: string): string | null {
  if (!value) {
    return 'Выберите университет'
  }
  return null
}
