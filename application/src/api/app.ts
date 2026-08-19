import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { QueryService, NotFoundError, BadRequestError } from '../services/query-service.js';
import { AnalysisOrchestrator } from '../services/analysis-orchestrator.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createWebsitesRouter } from './routes/websites.js';
import { createPagesRouter } from './routes/pages.js';
import { createHealthRouter } from './routes/health.js';
import { SessionRepository } from '../repository/session-repository.js';
import { AIAnalysisRepository } from '../repository/ai-analysis-repository.js';
import { ErrorResponseDto } from './schemas/responses.js';

export function createApp(sessionRepo: SessionRepository, aiRepo: AIAnalysisRepository): Express {
  const app = express();
  const queryService = new QueryService(sessionRepo, aiRepo);
  const orchestrator = new AnalysisOrchestrator(sessionRepo, aiRepo);

  // Configurable CORS
  const corsOriginsEnv = process.env['APPLICATION_CORS_ORIGINS'];
  const allowedOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map((o) => o.trim())
    : '*';

  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '20mb' }));

  // Root health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Mount API routers
  // 0. System health & status routes (/api/health, /api/system/status)
  app.use('/api', createHealthRouter(sessionRepo, orchestrator.aiServiceUrl));

  // 1. Sessions root (/api/sessions)
  app.use('/api/sessions', createSessionsRouter(queryService, orchestrator, sessionRepo));

  // 2. Websites sub-routes (/api/sessions/:sessionId/websites)
  app.use('/api/sessions', createWebsitesRouter(queryService));

  // 3. Pages sub-routes (/api/sessions/:sessionId/websites/:websiteId/pages)
  app.use('/api/sessions', createPagesRouter(queryService));

  // Global Error Handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFoundError) {
      const response: ErrorResponseDto = {
        error: 'NotFound',
        message: err.message,
        statusCode: 404
      };
      res.status(404).json(response);
      return;
    }

    if (err instanceof BadRequestError) {
      const response: ErrorResponseDto = {
        error: 'BadRequest',
        message: err.message,
        statusCode: 400
      };
      res.status(400).json(response);
      return;
    }

    // Generic safe internal error (does not leak DB credentials/traces)
    const response: ErrorResponseDto = {
      error: 'InternalServerError',
      message: 'An internal server error occurred.',
      statusCode: 500
    };
    res.status(500).json(response);
  });

  return app;
}
