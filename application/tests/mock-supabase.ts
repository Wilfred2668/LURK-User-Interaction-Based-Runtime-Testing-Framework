import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../src/types/models.js';

interface TableStorage {
  sessions: Map<string, Record<string, unknown>>;
  websites: Map<string, Record<string, unknown>>;
  pages: Map<string, Record<string, unknown>>;
  routes: Map<string, Record<string, unknown>>;
  runtime_events: Map<string, Record<string, unknown>>;
  ai_analysis_batches: Map<string, Record<string, unknown>>;
  ai_analysis_findings: Map<string, Record<string, unknown>>;
}

export function createMockSupabaseClient(): SupabaseClient<Database> {
  const storage: TableStorage = {
    sessions: new Map(),
    websites: new Map(),
    pages: new Map(),
    routes: new Map(),
    runtime_events: new Map(),
    ai_analysis_batches: new Map(),
    ai_analysis_findings: new Map()
  };

  const client = {
    _storage: storage,
    from(tableName: keyof TableStorage) {
      let filters: Array<{ column: string; value: unknown }> = [];
      let sortColumn: string | null = null;
      let sortAscending = true;

      const builder = {
        async upsert(rows: Record<string, unknown> | Array<Record<string, unknown>>, options?: { onConflict?: string }) {
          const rowList = Array.isArray(rows) ? rows : [rows];
          const tableMap = storage[tableName];
          const primaryKey = options?.onConflict || (tableName === 'sessions' ? 'session_id' : `${tableName.slice(0, -1)}_id`);

          for (const r of rowList) {
            const pkVal = String(r[primaryKey] ?? '');
            if (!pkVal) {
              return { error: { message: `Missing primary key ${primaryKey}` }, data: null };
            }
            // Deep clone to ensure mutation isolation
            tableMap.set(pkVal, JSON.parse(JSON.stringify(r)));
          }
          return { error: null, data: null };
        },

        select(_columns = '*') {
          return builder;
        },

        eq(column: string, value: unknown) {
          filters.push({ column, value });
          return builder;
        },

        order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
          sortColumn = column;
          sortAscending = ascending;
          return builder;
        },

        async maybeSingle() {
          const result = await builder._execute();
          if (result.error) return { error: result.error, data: null };
          return { error: null, data: result.data[0] || null };
        },

        async then(resolve: (value: { error: null; data: Record<string, unknown>[] }) => void) {
          const result = await builder._execute();
          resolve(result);
        },

        async _execute(): Promise<{ error: null; data: Record<string, unknown>[] }> {
          const tableMap = storage[tableName];
          let records = Array.from(tableMap.values()).map((v) => JSON.parse(JSON.stringify(v)));

          for (const f of filters) {
            records = records.filter((r) => r[f.column] === f.value);
          }

          if (sortColumn) {
            records.sort((a, b) => {
              const valA = a[sortColumn!];
              const valB = b[sortColumn!];
              if (valA < valB) return sortAscending ? -1 : 1;
              if (valA > valB) return sortAscending ? 1 : -1;
              return 0;
            });
          }

          return { error: null, data: records };
        }
      };

      return builder as unknown as ReturnType<SupabaseClient<Database>['from']>;
    }
  };

  return client as unknown as SupabaseClient<Database>;
}
