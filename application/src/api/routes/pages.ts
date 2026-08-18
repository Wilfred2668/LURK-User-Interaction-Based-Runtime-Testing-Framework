import { Router, Request, Response, NextFunction } from 'express';
import { QueryService } from '../../services/query-service.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export function createPagesRouter(queryService: QueryService): Router {
  const router = Router();

  // GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId
  router.get(
    '/:sessionId/websites/:websiteId/pages/:pageId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = getParam(req.params.sessionId);
        const websiteId = getParam(req.params.websiteId);
        const pageId = getParam(req.params.pageId);
        const page = await queryService.getPageOverview(sessionId, websiteId, pageId);
        res.json(page);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/routes
  router.get(
    '/:sessionId/websites/:websiteId/pages/:pageId/routes',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = getParam(req.params.sessionId);
        const websiteId = getParam(req.params.websiteId);
        const pageId = getParam(req.params.pageId);
        const routes = await queryService.getRoutesForPage(sessionId, websiteId, pageId);
        res.json(routes);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/events
  router.get(
    '/:sessionId/websites/:websiteId/pages/:pageId/events',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = getParam(req.params.sessionId);
        const websiteId = getParam(req.params.websiteId);
        const pageId = getParam(req.params.pageId);
        const events = await queryService.getEventsForPage(sessionId, websiteId, pageId);
        res.json(events);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/findings
  router.get(
    '/:sessionId/websites/:websiteId/pages/:pageId/findings',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = getParam(req.params.sessionId);
        const websiteId = getParam(req.params.websiteId);
        const pageId = getParam(req.params.pageId);
        const findings = await queryService.getFindingsForPage(sessionId, websiteId, pageId);
        res.json(findings);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/sessions/:sessionId/websites/:websiteId/pages/:pageId/analysis
  router.get(
    '/:sessionId/websites/:websiteId/pages/:pageId/analysis',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = getParam(req.params.sessionId);
        const websiteId = getParam(req.params.websiteId);
        const pageId = getParam(req.params.pageId);
        const analysis = await queryService.getPageAnalysis(sessionId, websiteId, pageId);
        res.json(analysis);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
