/**
 * Application models and database schema types.
 */

import { DatabaseAIAnalysisBatchRow, DatabaseAIAnalysisFindingRow } from './ai-models.js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface SessionRecord {
  sessionId: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  rootUrl: string | null;
  activeTabId: number | null;
  persistedAt: string;
}

export interface WebsiteRecord {
  websiteId: string;
  sessionId: string;
  origin: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PageRecord {
  pageId: string;
  sessionId: string;
  websiteId: string;
  websiteOrigin: string;
  tabId: number;
  url: string;
  title: string;
  createdAt: string;
}

export interface RouteRecord {
  routeId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  tabId: number;
  url: string;
  path: string;
  hash: string;
  timestamp: string;
  navigationType: string;
}

export interface RuntimeEventRecord {
  eventId: string;
  sessionId: string;
  websiteId: string;
  pageId: string;
  routeId: string | null;
  tabId: number | null;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
}

// Database Row representations (snake_case)
export interface DatabaseSessionRow {
  session_id: string;
  status: string;
  started_at: string;
  ended_at: string;
  duration_ms: number | string;
  root_url: string | null;
  active_tab_id: number | null;
  persisted_at: string;
}

export interface DatabaseWebsiteRow {
  website_id: string;
  session_id: string;
  origin: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface DatabasePageRow {
  page_id: string;
  session_id: string;
  website_id: string;
  website_origin: string;
  tab_id: number;
  url: string;
  title: string;
  created_at: string;
}

export interface DatabaseRouteRow {
  route_id: string;
  session_id: string;
  website_id: string;
  page_id: string;
  tab_id: number;
  url: string;
  path: string;
  hash: string;
  timestamp: string;
  navigation_type: string;
}

export interface DatabaseRuntimeEventRow {
  event_id: string;
  session_id: string;
  website_id: string;
  page_id: string;
  route_id: string | null;
  tab_id: number | null;
  timestamp: string;
  type: string;
  data: Json;
}

export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: DatabaseSessionRow;
        Insert: DatabaseSessionRow;
        Update: Partial<DatabaseSessionRow>;
        Relationships: [];
      };
      websites: {
        Row: DatabaseWebsiteRow;
        Insert: DatabaseWebsiteRow;
        Update: Partial<DatabaseWebsiteRow>;
        Relationships: [
          {
            foreignKeyName: 'websites_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['session_id'];
          }
        ];
      };
      pages: {
        Row: DatabasePageRow;
        Insert: DatabasePageRow;
        Update: Partial<DatabasePageRow>;
        Relationships: [
          {
            foreignKeyName: 'pages_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['session_id'];
          },
          {
            foreignKeyName: 'pages_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['website_id'];
          }
        ];
      };
      routes: {
        Row: DatabaseRouteRow;
        Insert: DatabaseRouteRow;
        Update: Partial<DatabaseRouteRow>;
        Relationships: [
          {
            foreignKeyName: 'routes_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['session_id'];
          },
          {
            foreignKeyName: 'routes_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['website_id'];
          },
          {
            foreignKeyName: 'routes_page_id_fkey';
            columns: ['page_id'];
            isOneToOne: false;
            referencedRelation: 'pages';
            referencedColumns: ['page_id'];
          }
        ];
      };
      runtime_events: {
        Row: DatabaseRuntimeEventRow;
        Insert: DatabaseRuntimeEventRow;
        Update: Partial<DatabaseRuntimeEventRow>;
        Relationships: [
          {
            foreignKeyName: 'runtime_events_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['session_id'];
          },
          {
            foreignKeyName: 'runtime_events_website_id_fkey';
            columns: ['website_id'];
            isOneToOne: false;
            referencedRelation: 'websites';
            referencedColumns: ['website_id'];
          },
          {
            foreignKeyName: 'runtime_events_page_id_fkey';
            columns: ['page_id'];
            isOneToOne: false;
            referencedRelation: 'pages';
            referencedColumns: ['page_id'];
          },
          {
            foreignKeyName: 'runtime_events_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'routes';
            referencedColumns: ['route_id'];
          }
        ];
      };
      ai_analysis_batches: {
        Row: DatabaseAIAnalysisBatchRow;
        Insert: DatabaseAIAnalysisBatchRow;
        Update: Partial<DatabaseAIAnalysisBatchRow>;
        Relationships: [];
      };
      ai_analysis_findings: {
        Row: DatabaseAIAnalysisFindingRow;
        Insert: DatabaseAIAnalysisFindingRow;
        Update: Partial<DatabaseAIAnalysisFindingRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
