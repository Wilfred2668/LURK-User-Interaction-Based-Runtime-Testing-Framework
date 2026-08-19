import { Router, Request, Response } from 'express';
import { SessionRepository } from '../../repository/session-repository.js';

export function createHealthRouter(
  sessionRepo: SessionRepository,
  aiServiceUrl: string = process.env['AI_SERVICE_URL'] || 'http://localhost:8000'
): Router {
  const router = Router();
  const normalizedAiUrl = aiServiceUrl.replace(/\/+$/, '');

  router.get('/health', async (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'runtime-monitoring-application',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/system/status', async (_req: Request, res: Response) => {
    // 1. Check Supabase DB
    let dbStatus = 'connected';
    let dbError: string | null = null;
    try {
      await sessionRepo.listSessions();
    } catch (err: any) {
      dbStatus = 'disconnected';
      dbError = err.message || 'Database query failed';
    }

    // 2. Check AI Service (Lightweight ping without LLM invocation)
    let aiStatus = 'available';
    let aiError: string | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const aiRes = await fetch(`${normalizedAiUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!aiRes.ok) {
        aiStatus = 'degraded';
        aiError = `HTTP ${aiRes.status}`;
      }
    } catch (err: any) {
      aiStatus = 'unreachable';
      aiError = err.message || 'Connection refused';
    }

    const overallHealthy = dbStatus === 'connected' && aiStatus !== 'unreachable';

    res.json({
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      components: {
        applicationApi: {
          status: 'connected',
          port: Number(process.env['PORT']) || 3001
        },
        database: {
          status: dbStatus,
          provider: 'supabase-postgresql',
          ...(dbError ? { error: dbError } : {})
        },
        aiService: {
          status: aiStatus,
          url: normalizedAiUrl,
          ...(aiError ? { error: aiError } : {})
        }
      }
    });
  });

  return router;
}
