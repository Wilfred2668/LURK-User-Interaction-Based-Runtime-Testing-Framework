-- =============================================================================
-- Milestone 4B: AI Analysis Results Schema
-- PostgreSQL DDL for Supabase
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AI ANALYSIS BATCHES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_analysis_batches (
    batch_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    website_id TEXT NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
    website_origin TEXT NOT NULL,
    schema_version TEXT NOT NULL DEFAULT '3A.1',
    analysis_version TEXT NOT NULL DEFAULT '3C.1',
    status TEXT NOT NULL DEFAULT 'completed',
    summary TEXT NOT NULL,
    engineering_assessment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 2. AI ANALYSIS FINDINGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_analysis_findings (
    finding_id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES ai_analysis_batches(batch_id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    website_id TEXT NOT NULL REFERENCES websites(website_id) ON DELETE CASCADE,
    page_id TEXT NOT NULL REFERENCES pages(page_id) ON DELETE CASCADE,
    finding_type TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    observed_fact TEXT NOT NULL,
    possible_interpretation TEXT NOT NULL,
    required_additional_context TEXT NOT NULL,
    analysis TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    likely_impact TEXT,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_analysis_batches_session_id ON ai_analysis_batches(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_batches_website_id ON ai_analysis_batches(website_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_batches_page_id ON ai_analysis_batches(page_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_findings_batch_id ON ai_analysis_findings(batch_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_findings_session_id ON ai_analysis_findings(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_findings_website_id ON ai_analysis_findings(website_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_findings_page_id ON ai_analysis_findings(page_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_findings_severity ON ai_analysis_findings(severity);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_findings_finding_type ON ai_analysis_findings(finding_type);
