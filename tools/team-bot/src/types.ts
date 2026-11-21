export interface Env {
  DB: D1Database;
  JOBS: Queue<{ id: string }>;
  AI?: { run(model: string, input: Record<string, unknown>): Promise<unknown> };
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_TELEGRAM_IDS: string;
  DIAGNOSTIC_SECRET?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_REF?: string;
  GITHUB_CACHE_TTL?: string;
  AI_MODEL?: string;
  AI_CONTEXT_CHARS?: string;
  AI_MAX_TOKENS?: string;
  AI_DAILY_GLOBAL_REQUESTS?: string;
  AI_DAILY_USER_REQUESTS?: string;
  AI_DAILY_NEURON_BUDGET?: string;
  AI_DAILY_TOKEN_BUDGET?: string;
  ENABLE_YANDEX_FALLBACK?: string;
  YANDEX_API_KEY?: string;
  YANDEX_FOLDER_ID?: string;
  YANDEX_MODEL?: string;
  REMINDER_HOURS?: string;
  ESCALATION_HOURS?: string;
  STALE_DAYS?: string;
}
export type Fetcher = typeof fetch;
export type Role = 'participant' | 'lead' | 'tech_lead' | 'project_manager';
export interface Member {
  slug: string;
  name: string;
  role: string;
  department: string;
  code: string;
  lead_slug: string | null;
  issue_number: number;
  task: string;
  deliverable: string;
  steps: string[];
  depends: string;
}
export interface TeamData {
  members: Member[];
  groups: { title: string; lead_slug: string; member_slugs: string[] }[];
}
export interface User {
  telegram_id: number;
  slug: string | null;
  status: string;
  notify: number;
}
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
}
export interface Button {
  text: string;
  callback_data: string;
}
export type Markup = { inline_keyboard: Button[][] };
export interface Blocker {
  id: string;
  author: number;
  target: string;
  issue: number;
  summary: string;
  state: string;
  consent: number;
  stage: number;
  critical: number;
  created: number;
  updated: number;
  due: number;
}
export interface Job {
  id: string;
  kind: string;
  payload: string;
  attempts: number;
}
export class UserError extends Error {}
export class RetryError extends Error {
  constructor(public delay = 60) {
    super('temporary_external_failure');
  }
}
export const now = () => Math.floor(Date.now() / 1000);
export const int = (value: string | undefined, fallback: number, max = 1000000) =>
  Math.min(max, Math.max(1, Number.parseInt(value || '', 10) || fallback));
export const buttons = (rows: [string, string][][]): Markup => ({
  inline_keyboard: rows.map((row) => row.map(([text, callback_data]) => ({ text, callback_data }))),
});
