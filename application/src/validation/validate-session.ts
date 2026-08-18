import { z } from 'zod';
import { RawFinalizedSessionPackage } from '../types/raw.js';

const RawSessionStatusSchema = z.enum(['active', 'completed', 'finalized', 'stopped']);
const RawRouteNavigationTypeSchema = z.enum(['initial', 'pushState', 'replaceState', 'popstate', 'hashchange']);
const RawRuntimeEventTypeSchema = z.enum(['console', 'network', 'performance', 'dom', 'accessibility', 'interaction']);

const RawRuntimeEventSchema = z.object({
  eventId: z.string().min(1, 'eventId must not be empty'),
  sessionId: z.string().min(1, 'sessionId must not be empty'),
  pageId: z.string().nullable(),
  routeId: z.string().nullable().optional(),
  tabId: z.number().nullable(),
  timestamp: z.string().min(1, 'timestamp must not be empty'),
  type: RawRuntimeEventTypeSchema,
  data: z.record(z.unknown())
});

const RawRouteRecordSchema = z.object({
  routeId: z.string().min(1, 'routeId must not be empty'),
  sessionId: z.string().min(1, 'sessionId must not be empty'),
  pageId: z.string().min(1, 'pageId must not be empty'),
  tabId: z.number(),
  url: z.string().min(1, 'url must not be empty'),
  path: z.string(),
  hash: z.string(),
  timestamp: z.string().min(1, 'timestamp must not be empty'),
  navigationType: RawRouteNavigationTypeSchema
});

const RawFinalizedPageDataSchema = z.object({
  pageId: z.string().min(1, 'pageId must not be empty'),
  sessionId: z.string().min(1, 'sessionId must not be empty'),
  websiteId: z.string().min(1, 'websiteId must not be empty'),
  websiteOrigin: z.string().min(1, 'websiteOrigin must not be empty'),
  tabId: z.number(),
  url: z.string().min(1, 'url must not be empty'),
  title: z.string(),
  createdAt: z.string().min(1, 'createdAt must not be empty'),
  routes: z.array(RawRouteRecordSchema),
  events: z.array(RawRuntimeEventSchema)
});

const RawFinalizedWebsiteDataSchema = z.object({
  websiteId: z.string().min(1, 'websiteId must not be empty'),
  sessionId: z.string().min(1, 'sessionId must not be empty'),
  origin: z.string().refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
    message: 'origin must start with http:// or https://'
  }),
  firstSeenAt: z.string().min(1, 'firstSeenAt must not be empty'),
  lastSeenAt: z.string().min(1, 'lastSeenAt must not be empty'),
  pages: z.array(RawFinalizedPageDataSchema)
});

const RawFinalizedSessionMetadataSchema = z.object({
  sessionId: z.string().min(1, 'sessionId must not be empty'),
  status: RawSessionStatusSchema,
  startedAt: z.string().min(1, 'startedAt must not be empty'),
  endedAt: z.string().min(1, 'endedAt must not be empty'),
  durationMs: z.number().nonnegative('durationMs must be non-negative'),
  rootUrl: z.string().nullable(),
  activeTabId: z.number().nullable()
});

export const FinalizedSessionPackageSchema = z.object({
  session: RawFinalizedSessionMetadataSchema,
  websites: z.array(RawFinalizedWebsiteDataSchema)
});

export function validateFinalizedSessionPackage(
  input: unknown
): RawFinalizedSessionPackage {
  const parsed = FinalizedSessionPackageSchema.parse(input);

  const sessionId = parsed.session.sessionId;

  // Verify relational hierarchy consistency
  for (const website of parsed.websites) {
    if (website.sessionId !== sessionId) {
      throw new Error(
        `Website ${website.websiteId} sessionId '${website.sessionId}' does not match session '${sessionId}'`
      );
    }

    for (const page of website.pages) {
      if (page.sessionId !== sessionId) {
        throw new Error(
          `Page ${page.pageId} sessionId '${page.sessionId}' does not match session '${sessionId}'`
        );
      }
      if (page.websiteId !== website.websiteId) {
        throw new Error(
          `Page ${page.pageId} websiteId '${page.websiteId}' does not match website '${website.websiteId}'`
        );
      }

      for (const route of page.routes) {
        if (route.sessionId !== sessionId) {
          throw new Error(
            `Route ${route.routeId} sessionId '${route.sessionId}' does not match session '${sessionId}'`
          );
        }
        if (route.pageId !== page.pageId) {
          throw new Error(
            `Route ${route.routeId} pageId '${route.pageId}' does not match page '${page.pageId}'`
          );
        }
      }

      for (const event of page.events) {
        if (event.sessionId !== sessionId) {
          throw new Error(
            `Event ${event.eventId} sessionId '${event.sessionId}' does not match session '${sessionId}'`
          );
        }
        if (event.pageId && event.pageId !== page.pageId) {
          throw new Error(
            `Event ${event.eventId} pageId '${event.pageId}' does not match page '${page.pageId}'`
          );
        }
      }
    }
  }

  return parsed as RawFinalizedSessionPackage;
}
