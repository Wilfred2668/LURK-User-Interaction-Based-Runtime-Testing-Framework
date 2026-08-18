import { createSupabaseClient } from './db/supabase-client.js';
import { SessionRepository } from './repository/session-repository.js';
import { AIAnalysisRepository } from './repository/ai-analysis-repository.js';
import { createApp } from './api/app.js';

const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;

try {
  const supabaseClient = createSupabaseClient();
  const sessionRepo = new SessionRepository(supabaseClient);
  const aiRepo = new AIAnalysisRepository(supabaseClient);

  const app = createApp(sessionRepo, aiRepo);

  app.listen(port, () => {
    console.log(`[Application API] Server running on http://localhost:${port}`);
  });
} catch (err) {
  console.error('[Application API] Failed to start server:', err);
  process.exit(1);
}
