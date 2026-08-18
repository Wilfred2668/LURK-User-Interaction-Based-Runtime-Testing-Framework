-- =============================================================================
-- Milestone 4A: Runtime Monitoring Application Schema
-- PostgreSQL DDL for Supabase
-- =============================================================================

-- Enable UUID extension if needed in future
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. SESSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    root_url TEXT,
    active_tab_id INTEGER,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. WEBSITES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS websites (
    website_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    origin TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_websites_session_origin UNIQUE (session_id, origin)
);

-- -----------------------------------------------------------------------------
-- 3. PAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
    page_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    website_id TEXT NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    website_origin TEXT NOT NULL,
    tab_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 4. ROUTES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
    route_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    website_id TEXT NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
    tab_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL DEFAULT '',
    timestamp TIMESTAMPTZ NOT NULL,
    navigation_type TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 5. RUNTIME EVENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runtime_events (
    event_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    website_id TEXT NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
    route_id TEXT REFERENCES routes(route_id) ON DELETE SET NULL,
    tab_id INTEGER,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    data JSONB NOT NULL
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_websites_session_id ON websites(session_id);
CREATE INDEX IF NOT EXISTS idx_pages_session_id ON pages(session_id);
CREATE INDEX IF NOT EXISTS idx_pages_website_id ON pages(website_id);
CREATE INDEX IF NOT EXISTS idx_routes_session_id ON routes(session_id);
CREATE INDEX IF NOT EXISTS idx_routes_page_id ON routes(page_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_session_id ON runtime_events(session_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_website_id ON runtime_events(website_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_page_id ON runtime_events(page_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_type ON runtime_events(type);
