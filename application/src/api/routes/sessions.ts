import { Router, Request, Response, NextFunction } from 'express';
import { QueryService } from '../../services/query-service.js';
import { SessionRepository } from '../../repository/session-repository.js';
import { AnalysisOrchestrator } from '../../services/analysis-orchestrator.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export function createSessionsRouter(
  queryService: QueryService,
  orchestrator?: AnalysisOrchestrator,
  sessionRepo?: SessionRepository
): Router {
  const router = Router();

  // GET /api/sessions
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await queryService.listSessions();
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/sessions / POST /api/sessions/ingest (Extension / Client Session Ingestion)
  const handleIngest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!sessionRepo) {
        res.status(501).json({ error: 'NotImplemented', message: 'Session ingestion repository not configured.' });
        return;
      }

      const pkg = req.body;
      if (!pkg || !pkg.session || !pkg.websites) {
        res.status(400).json({ error: 'BadRequest', message: 'Invalid finalized session package payload.' });
        return;
      }

      await sessionRepo.saveFinalizedSession(pkg);
      res.status(201).json({
        success: true,
        sessionId: pkg.session.sessionId,
        message: `Session '${pkg.session.sessionId}' successfully ingested and persisted.`
      });
    } catch (err: any) {
      if (err.name === 'ValidationError') {
        res.status(400).json({ error: 'ValidationError', message: err.message });
        return;
      }
      next(err);
    }
  };

  router.post('/', handleIngest);
  router.post('/ingest', handleIngest);

  // GET /api/sessions/:sessionId
  router.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const overview = await queryService.getSessionOverview(sessionId);
      res.json(overview);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/sessions/:sessionId/analyze
  router.post('/:sessionId/analyze', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const { pageIds } = req.body || {};

      if (!orchestrator) {
        res.status(501).json({ error: 'NotImplemented', message: 'Orchestrator not configured.' });
        return;
      }

      const result = await orchestrator.runAnalysisForPages(sessionId, pageIds || []);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/sessions/:sessionId/websites
  router.get('/:sessionId/websites', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const websites = await queryService.getWebsitesForSession(sessionId);
      res.json(websites);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/sessions/:sessionId/findings
  router.get('/:sessionId/findings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const { severity, findingType } = req.query;
      const findings = await queryService.getFindingsForSession(sessionId, {
        severity: typeof severity === 'string' ? severity : undefined,
        findingType: typeof findingType === 'string' ? findingType : undefined
      });
      res.json(findings);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
