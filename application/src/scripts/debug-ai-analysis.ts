import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { SessionRepository } from '../repository/session-repository.js';
import { AIAnalysisRepository } from '../repository/ai-analysis-repository.js';
import { AnalysisOrchestrator } from '../services/analysis-orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env['SUPABASE_URL']!;
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_ANON_KEY']!;
const supabase = createClient(supabaseUrl, supabaseKey);

const sessionRepo = new SessionRepository(supabase);
const aiRepo = new AIAnalysisRepository(supabase);
const orchestrator = new AnalysisOrchestrator(sessionRepo, aiRepo, 'http://localhost:8000');

async function checkLatest() {
  const sessions = await sessionRepo.listSessions();
  console.log('Recent sessions:', sessions.map(s => ({ id: s.sessionId, started: s.startedAt })));

  if (sessions.length === 0) return;
  const latest = sessions[0]!;
  console.log('Testing analysis on latest session:', latest.sessionId);

  const websites = await sessionRepo.getWebsitesForSession(latest.sessionId);
  for (const w of websites) {
    const pages = await sessionRepo.getPagesForWebsite(latest.sessionId, w.websiteId);
    console.log(`Website ${w.origin} has pages:`, pages.map(p => ({ id: p.pageId, url: p.url })));

    if (pages.length > 0) {
      const page = pages[0]!;
      console.log('Triggering analysis for page:', page.pageId);
      const res = await orchestrator.runAnalysisForPages(latest.sessionId, [page.pageId]);
      console.log('Result:', JSON.stringify(res, null, 2));

      const batch = await aiRepo.getAnalysisBatchForPage(latest.sessionId, w.websiteId, page.pageId);
      console.log('Batch in DB:', batch ? { status: batch.status, summary: batch.summary, assessment: batch.engineeringAssessment } : null);
      const findings = await aiRepo.getFindingsForBatch(batch?.batchId || '');
      console.log('Findings in DB:', findings.map(f => ({ id: f.findingId, title: f.title, fact: f.observedFact, interp: f.possibleInterpretation })));
    }
  }
}

checkLatest().catch(console.error);
