CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  categories TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  site_url TEXT,
  type TEXT NOT NULL DEFAULT 'rss',
  lang TEXT NOT NULL DEFAULT 'en',
  categories TEXT NOT NULL DEFAULT '[]',
  reliability INTEGER NOT NULL DEFAULT 3 CHECK (reliability BETWEEN 1 AND 5),
  official INTEGER NOT NULL DEFAULT 0,
  security INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  verified INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_error TEXT
);
CREATE TABLE articles (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_norm TEXT NOT NULL,
  desc_norm TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  source_id INTEGER NOT NULL REFERENCES sources(id),
  category TEXT NOT NULL,
  lang TEXT NOT NULL,
  official INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  updated_at TEXT,
  collected_at TEXT NOT NULL,
  sort_ts TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_limited INTEGER NOT NULL DEFAULT 0,
  importance TEXT NOT NULL CHECK (importance IN ('critical','important','follow','minor')),
  score REAL NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  cvss REAL,
  cvss_source TEXT,
  links TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_articles_sort ON articles(sort_ts DESC);
CREATE INDEX idx_articles_cat ON articles(category, sort_ts DESC);
CREATE INDEX idx_articles_imp ON articles(importance, sort_ts DESC);
CREATE TABLE article_sources (
  id INTEGER PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id),
  source_id INTEGER NOT NULL REFERENCES sources(id),
  url TEXT NOT NULL,
  url_norm TEXT NOT NULL UNIQUE,
  published_at TEXT,
  collected_at TEXT NOT NULL
);
CREATE INDEX idx_article_sources_article ON article_sources(article_id);
CREATE TABLE user_article_state (
  user_id INTEGER NOT NULL REFERENCES users(id),
  article_id INTEGER NOT NULL REFERENCES articles(id),
  is_read INTEGER NOT NULL DEFAULT 0,
  favorite INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT,
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX idx_state_opened ON user_article_state(user_id, last_opened_at DESC);
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, url)
);
CREATE TABLE collect_runs (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','ok','partial','failed')),
  sources_total INTEGER NOT NULL DEFAULT 0,
  sources_ok INTEGER NOT NULL DEFAULT 0,
  fetched INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  errors TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE briefings (
  day TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  article_ids TEXT NOT NULL,
  topics TEXT NOT NULL DEFAULT '[]'
);
