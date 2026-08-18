import { SupabaseClient } from '@supabase/supabase-js';
import {
  Database,
  DatabasePageRow,
  DatabaseRouteRow,
  DatabaseRuntimeEventRow,
  DatabaseSessionRow,
  DatabaseWebsiteRow,
  Json,
  PageRecord,
  RouteRecord,
  RuntimeEventRecord,
  SessionRecord,
  WebsiteRecord
} from '../types/models.js';
import { RawFinalizedSessionPackage } from '../types/raw.js';
import { validateFinalizedSessionPackage } from '../validation/validate-session.js';

export function rowToSessionRecord(row: DatabaseSessionRow): SessionRecord {
  return {
    sessionId: row.session_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: typeof row.duration_ms === 'string' ? parseInt(row.duration_ms, 10) : row.duration_ms,
    rootUrl: row.root_url,
    activeTabId: row.active_tab_id,
    persistedAt: row.persisted_at
  };
}

export function rowToWebsiteRecord(row: DatabaseWebsiteRow): WebsiteRecord {
  return {
    websiteId: row.website_id,
    sessionId: row.session_id,
    origin: row.origin,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at
  };
}

export function rowToPageRecord(row: DatabasePageRow): PageRecord {
  return {
    pageId: row.page_id,
    sessionId: row.session_id,
    websiteId: row.website_id,
    websiteOrigin: row.website_origin,
    tabId: row.tab_id,
    url: row.url,
    title: row.title,
    createdAt: row.created_at
  };
}

export function rowToRouteRecord(row: DatabaseRouteRow): RouteRecord {
  return {
    routeId: row.route_id,
    sessionId: row.session_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    tabId: row.tab_id,
    url: row.url,
    path: row.path,
    hash: row.hash,
    timestamp: row.timestamp,
    navigationType: row.navigation_type
  };
}

export function rowToRuntimeEventRecord(row: DatabaseRuntimeEventRow): RuntimeEventRecord {
  return {
    eventId: row.event_id,
    sessionId: row.session_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    routeId: row.route_id,
    tabId: row.tab_id,
    timestamp: row.timestamp,
    type: row.type,
    data: (row.data as Record<string, unknown>) || {}
  };
}

export class SessionRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Idempotently persists a finalized session package into Supabase PostgreSQL.
   */
  async saveFinalizedSession(sessionPackage: RawFinalizedSessionPackage): Promise<void> {
    // 1. Strict validation
    const validated = validateFinalizedSessionPackage(sessionPackage);
    const sessionMeta = validated.session;

    // 2. Upsert Session row
    const sessionRow: DatabaseSessionRow = {
      session_id: sessionMeta.sessionId,
      status: sessionMeta.status,
      started_at: sessionMeta.startedAt,
      ended_at: sessionMeta.endedAt,
      duration_ms: sessionMeta.durationMs,
      root_url: sessionMeta.rootUrl,
      active_tab_id: sessionMeta.activeTabId,
      persisted_at: new Date().toISOString()
    };

    const { error: sessionError } = await (this.client as any)
      .from('sessions')
      .upsert(sessionRow, { onConflict: 'session_id' });

    if (sessionError) {
      throw new Error(`Failed to persist session: ${sessionError.message}`);
    }

    // Prepare rows for websites, pages, routes, events
    const websiteRows: DatabaseWebsiteRow[] = [];
    const pageRows: DatabasePageRow[] = [];
    const routeRows: DatabaseRouteRow[] = [];
    const eventRows: DatabaseRuntimeEventRow[] = [];

    for (const website of validated.websites) {
      websiteRows.push({
        website_id: website.websiteId,
        session_id: website.sessionId,
        origin: website.origin,
        first_seen_at: website.firstSeenAt,
        last_seen_at: website.lastSeenAt
      });

      for (const page of website.pages) {
        pageRows.push({
          page_id: page.pageId,
          session_id: page.sessionId,
          website_id: page.websiteId,
          website_origin: page.websiteOrigin,
          tab_id: page.tabId,
          url: page.url,
          title: page.title,
          created_at: page.createdAt
        });

        for (const route of page.routes) {
          routeRows.push({
            route_id: route.routeId,
            session_id: route.sessionId,
            website_id: page.websiteId,
            page_id: page.pageId,
            tab_id: route.tabId,
            url: route.url,
            path: route.path,
            hash: route.hash,
            timestamp: route.timestamp,
            navigation_type: route.navigationType
          });
        }

        const pageRouteIds = new Set(page.routes.map((r) => r.routeId));
        for (const event of page.events) {
          const effectiveRouteId = event.routeId && pageRouteIds.has(event.routeId) ? event.routeId : null;
          eventRows.push({
            event_id: event.eventId,
            session_id: event.sessionId,
            website_id: page.websiteId,
            page_id: page.pageId,
            route_id: effectiveRouteId,
            tab_id: event.tabId,
            timestamp: event.timestamp,
            type: event.type,
            data: event.data as unknown as Json
          });
        }
      }
    }

    // 3. Upsert websites
    if (websiteRows.length > 0) {
      const { error: websiteError } = await (this.client as any)
        .from('websites')
        .upsert(websiteRows, { onConflict: 'website_id' });

      if (websiteError) {
        throw new Error(`Failed to persist websites: ${websiteError.message}`);
      }
    }

    // 4. Upsert pages
    if (pageRows.length > 0) {
      const { error: pageError } = await (this.client as any)
        .from('pages')
        .upsert(pageRows, { onConflict: 'page_id' });

      if (pageError) {
        throw new Error(`Failed to persist pages: ${pageError.message}`);
      }
    }

    // 5. Upsert routes
    if (routeRows.length > 0) {
      const { error: routeError } = await (this.client as any)
        .from('routes')
        .upsert(routeRows, { onConflict: 'route_id' });

      if (routeError) {
        throw new Error(`Failed to persist routes: ${routeError.message}`);
      }
    }

    // 6. Upsert runtime events
    if (eventRows.length > 0) {
      const { error: eventError } = await (this.client as any)
        .from('runtime_events')
        .upsert(eventRows, { onConflict: 'event_id' });

      if (eventError) {
        throw new Error(`Failed to persist runtime events: ${eventError.message}`);
      }
    }
  }

  /**
   * Retrieves a single session record by sessionId.
   */
  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const { data, error } = await (this.client as any)
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve session: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return rowToSessionRecord(data);
  }

  /**
   * Lists all sessions ordered by started_at descending.
   */
  async listSessions(): Promise<SessionRecord[]> {
    const { data, error } = await (this.client as any)
      .from('sessions')
      .select('*')
      .order('started_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }

    return (data || []).map(rowToSessionRecord);
  }

  /**
   * Retrieves all websites belonging to a session.
   */
  async getWebsitesForSession(sessionId: string): Promise<WebsiteRecord[]> {
    const { data, error } = await (this.client as any)
      .from('websites')
      .select('*')
      .eq('session_id', sessionId)
      .order('first_seen_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve websites for session: ${error.message}`);
    }

    return (data || []).map(rowToWebsiteRecord);
  }

  /**
   * Retrieves a specific website by sessionId and websiteId.
   */
  async getWebsite(sessionId: string, websiteId: string): Promise<WebsiteRecord | null> {
    const { data, error } = await (this.client as any)
      .from('websites')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve website: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return rowToWebsiteRecord(data);
  }

  /**
   * Retrieves all pages belonging to a specific website and session.
   * Guarantees strict website isolation.
   */
  async getPagesForWebsite(sessionId: string, websiteId: string): Promise<PageRecord[]> {
    const { data, error } = await (this.client as any)
      .from('pages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve pages for website: ${error.message}`);
    }

    return (data || []).map(rowToPageRecord);
  }

  /**
   * Retrieves all routes belonging to a specific page.
   */
  async getRoutesForPage(
    sessionId: string,
    websiteId: string,
    pageId: string
  ): Promise<RouteRecord[]> {
    const { data, error } = await (this.client as any)
      .from('routes')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .eq('page_id', pageId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve routes for page: ${error.message}`);
    }

    return (data || []).map(rowToRouteRecord);
  }

  /**
   * Retrieves all runtime events belonging to a specific page.
   * Guarantees raw JSONB preservation and event isolation.
   */
  async getEventsForPage(
    sessionId: string,
    websiteId: string,
    pageId: string
  ): Promise<RuntimeEventRecord[]> {
    const { data, error } = await (this.client as any)
      .from('runtime_events')
      .select('*')
      .eq('session_id', sessionId)
      .eq('website_id', websiteId)
      .eq('page_id', pageId)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to retrieve events for page: ${error.message}`);
    }

    return (data || []).map(rowToRuntimeEventRecord);
  }
}
