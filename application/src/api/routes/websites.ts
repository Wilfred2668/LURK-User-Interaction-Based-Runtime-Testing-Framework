import { Router, Request, Response, NextFunction } from 'express';
import { QueryService } from '../../services/query-service.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export function createWebsitesRouter(queryService: QueryService): Router {
  const router = Router();

  // GET /api/sessions/:sessionId/websites/:websiteId
  router.get('/:sessionId/websites/:websiteId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const websiteId = getParam(req.params.websiteId);
      const overview = await queryService.getWebsiteOverview(sessionId, websiteId);
      res.json(overview);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/sessions/:sessionId/websites/:websiteId/pages
  router.get('/:sessionId/websites/:websiteId/pages', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const websiteId = getParam(req.params.websiteId);
      const pages = await queryService.getPagesForWebsite(sessionId, websiteId);
      res.json(pages);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/sessions/:sessionId/websites/:websiteId/findings
  router.get('/:sessionId/websites/:websiteId/findings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = getParam(req.params.sessionId);
      const websiteId = getParam(req.params.websiteId);
      const { severity, findingType } = req.query;

      const findings = await queryService.getFindingsForWebsite(sessionId, websiteId, {
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
