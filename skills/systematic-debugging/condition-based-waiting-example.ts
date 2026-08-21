// Gongxu contributors 编写的自包含条件等待示例。
export interface StoredEvent {
  type: string;
  data?: unknown;
}

export interface EventStore {
  getEvents(streamId: string): readonly StoredEvent[];
}

export function waitForEvent(
  store: EventStore,
  streamId: string,
  predicate: (event: StoredEvent) => boolean,
  timeoutMs = 5000,
  pollIntervalMs = 10,
): Promise<StoredEvent> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      const event = store.getEvents(streamId).find(predicate);
      if (event) {
        resolve(event);
      } else if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for event after ${timeoutMs}ms`));
      } else {
        setTimeout(check, pollIntervalMs);
      }
    };
    check();
  });
}

export async function waitForEventCount(
  store: EventStore,
  streamId: string,
  type: string,
  count: number,
  timeoutMs = 5000,
): Promise<readonly StoredEvent[]> {
  await waitForEvent(
    store,
    streamId,
    () => store.getEvents(streamId).filter((event) => event.type === type).length >= count,
    timeoutMs,
  );
  return store.getEvents(streamId).filter((event) => event.type === type);
}
