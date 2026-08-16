import type { RuntimeEvent, RuntimeEventType } from '../types/runtime-event';

const DATABASE_NAME = 'runtime-monitor-db';
const DATABASE_VERSION = 1;
const STORE_NAME = 'runtimeEvents';

const INDEX_DEFINITIONS = [
  { name: 'eventId', keyPath: 'eventId', unique: true },
  { name: 'sessionId', keyPath: 'sessionId', unique: false },
  { name: 'pageId', keyPath: 'pageId', unique: false },
  { name: 'routeId', keyPath: 'routeId', unique: false },
  { name: 'tabId', keyPath: 'tabId', unique: false },
  { name: 'timestamp', keyPath: 'timestamp', unique: false },
  { name: 'type', keyPath: 'type', unique: false }
] as const;

function logDatabase(message: string): void {
  console.log(`[EVENT_DB] ${message}`);
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    throw new Error('IndexedDB is not available in this context.');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'eventId' });

        INDEX_DEFINITIONS.forEach(({ name, keyPath, unique }) => {
          if (!store.indexNames.contains(name)) {
            store.createIndex(name, keyPath, { unique });
          }
        });
      } else {
        const existingStore = request.transaction?.objectStore(STORE_NAME);
        INDEX_DEFINITIONS.forEach(({ name, keyPath, unique }) => {
          if (!existingStore?.indexNames.contains(name)) {
            existingStore?.createIndex(name, keyPath, { unique });
          }
        });
      }

      logDatabase('Database schema ensured.');
    };

    request.onsuccess = () => {
      logDatabase('Database opened');
      resolve(request.result);
    };

    request.onerror = () => {
      const error = request.error ?? new Error('Failed to open runtime event database.');
      console.error('[EVENT_DB] Database open failure:', error);
      reject(error);
    };
  });
}

function runStoreRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then((db) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = operation(store);

        request.onsuccess = () => {
          resolve(request.result as T);
        };

        request.onerror = () => {
          const error = request.error ?? new Error('IndexedDB request failed.');
          console.error('[EVENT_DB] Transaction failure:', error);
          reject(error);
        };

        transaction.oncomplete = () => {
          db.close();
        };

        transaction.onabort = () => {
          const error = transaction.error ?? new Error('IndexedDB transaction aborted.');
          console.error('[EVENT_DB] Transaction aborted:', error);
          reject(error);
        };
      })
      .catch(reject);
  });
}

export class RuntimeEventRepository {
  async add<T>(event: RuntimeEvent<T>): Promise<RuntimeEvent<T>> {
    return new Promise((resolve, reject) => {
      openDatabase()
        .then((db) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.add(event);

          request.onsuccess = () => {
            resolve(event);
          };

          request.onerror = () => {
            reject(request.error ?? new Error('Failed to add runtime event.'));
          };

          transaction.oncomplete = () => {
            db.close();
          };

          transaction.onerror = () => {
            reject(transaction.error ?? new Error('Runtime event write transaction failed.'));
          };
        })
        .catch(reject);
    });
  }

  async getById<T>(eventId: string): Promise<RuntimeEvent<T> | null> {
    return runStoreRequest('readonly', (store) => store.get(eventId));
  }

  async getAll<T>(): Promise<RuntimeEvent<T>[]> {
    return runStoreRequest('readonly', (store) => store.getAll());
  }

  async getBySessionId<T>(sessionId: string): Promise<RuntimeEvent<T>[]> {
    return this.queryByIndex<T>('sessionId', sessionId);
  }

  async getByPageId<T>(pageId: string): Promise<RuntimeEvent<T>[]> {
    return this.queryByIndex<T>('pageId', pageId);
  }

  async getByRouteId<T>(routeId: string): Promise<RuntimeEvent<T>[]> {
    return this.queryByIndex<T>('routeId', routeId);
  }

  async getByType<T>(type: RuntimeEventType): Promise<RuntimeEvent<T>[]> {
    return this.queryByIndex<T>('type', type);
  }

  async getByTimeRange<T>(start: string, end: string): Promise<RuntimeEvent<T>[]> {
    return new Promise((resolve, reject) => {
      openDatabase()
        .then((db) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index('timestamp');
          const request = index.getAll(IDBKeyRange.bound(start, end));

          request.onsuccess = () => {
            resolve((request.result ?? []) as RuntimeEvent<T>[]);
          };

          request.onerror = () => {
            reject(request.error ?? new Error('Failed to query events by time range.'));
          };

          transaction.oncomplete = () => {
            db.close();
          };
        })
        .catch(reject);
    });
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const events = await this.getBySessionId(sessionId);
    if (events.length === 0) {
      logDatabase(`No events found for session ${sessionId}.`);
      return 0;
    }

    return new Promise((resolve, reject) => {
      openDatabase()
        .then((db) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          let deletedCount = 0;

          events.forEach((event) => {
            const deleteRequest = store.delete(event.eventId);
            deleteRequest.onsuccess = () => {
              deletedCount += 1;
            };
            deleteRequest.onerror = () => {
              console.error('[EVENT_DB] Failed to delete event:', deleteRequest.error);
            };
          });

          transaction.oncomplete = () => {
            db.close();
            resolve(deletedCount);
          };

          transaction.onerror = () => {
            reject(transaction.error ?? new Error('Delete-by-session transaction failed.'));
          };
        })
        .catch(reject);
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      openDatabase()
        .then((db) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.clear();

          request.onsuccess = () => {
            logDatabase('Runtime event store cleared.');
            resolve();
          };

          request.onerror = () => {
            reject(request.error ?? new Error('Clear-runtime-events failed.'));
          };

          transaction.oncomplete = () => {
            db.close();
          };
        })
        .catch(reject);
    });
  }

  private async queryByIndex<T>(indexName: string, value: string): Promise<RuntimeEvent<T>[]> {
    return new Promise((resolve, reject) => {
      openDatabase()
        .then((db) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const index = store.index(indexName);
          const request = index.getAll(value);

          request.onsuccess = () => {
            resolve((request.result ?? []) as RuntimeEvent<T>[]);
          };

          request.onerror = () => {
            reject(request.error ?? new Error(`Failed to query ${indexName}.`));
          };

          transaction.oncomplete = () => {
            db.close();
          };
        })
        .catch(reject);
    });
  }
}

export const runtimeEventRepository = new RuntimeEventRepository();
export const EVENT_DATABASE_NAME = DATABASE_NAME;
export const EVENT_STORE_NAME = STORE_NAME;
export const EVENT_INDEX_NAMES = INDEX_DEFINITIONS.map((index) => index.name);
