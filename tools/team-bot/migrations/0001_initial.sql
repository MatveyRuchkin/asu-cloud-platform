PRAGMA foreign_keys = ON;
CREATE TABLE users (
  telegram_id INTEGER PRIMARY KEY, slug TEXT,
  status TEXT NOT NULL DEFAULT 'visitor'
    CHECK(status IN ('visitor','pending','approved','rejected','disabled')),
  notify INTEGER NOT NULL DEFAULT 0 CHECK(notify IN (0,1)),
  created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE UNIQUE INDEX approved_identity ON users(slug) WHERE status='approved';
CREATE TABLE registrations (
  id TEXT PRIMARY KEY, telegram_id INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  slug TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', decided_by INTEGER,
  created INTEGER NOT NULL, decided_at INTEGER
);
CREATE INDEX pending_registrations ON registrations(status,created);
CREATE TABLE blockers (
  id TEXT PRIMARY KEY, author INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  target TEXT NOT NULL, issue INTEGER NOT NULL, summary TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open', consent INTEGER NOT NULL DEFAULT 0,
  stage INTEGER NOT NULL DEFAULT 0, critical INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, due INTEGER NOT NULL
);
CREATE UNIQUE INDEX active_dependency ON blockers(author,target,issue)
  WHERE state NOT IN ('done','cancelled');
CREATE INDEX due_blockers ON blockers(consent,state,due);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, recipient INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  blocker TEXT REFERENCES blockers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, text TEXT NOT NULL, markup TEXT,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL, lease INTEGER NOT NULL DEFAULT 0,
  message_id INTEGER, updated INTEGER NOT NULL
);
CREATE INDEX pending_notifications ON notifications(status,available);
CREATE TABLE telegram_updates (
  update_id INTEGER PRIMARY KEY, telegram_id INTEGER NOT NULL,
  payload TEXT, created INTEGER NOT NULL, processed INTEGER
);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', available INTEGER NOT NULL,
  lease INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);
CREATE INDEX pending_jobs ON jobs(status,available,lease);
CREATE TABLE requests (
  update_id INTEGER PRIMARY KEY, telegram_id INTEGER NOT NULL REFERENCES users(telegram_id)
    ON DELETE CASCADE, kind TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE drafts (
  telegram_id INTEGER PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  summary TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE usage (
  key TEXT NOT NULL, day TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0, neurons INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(key,day)
);
CREATE TABLE rate_limits (
  telegram_id INTEGER PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL
);
CREATE TABLE github_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX expired_cache ON github_cache(expires);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
