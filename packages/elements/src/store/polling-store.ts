import { get, readable, Readable, writable } from 'svelte/store';

export function pollingStore<T>(
  startValue: T,
  pollingRequest: (currentState: T) => Promise<T>
): Readable<T> {
  const store = readable(startValue, (set) => {
    let value: T = startValue;

    const interval = setInterval(async () => {
      value = await pollingRequest(value);
      set(value);
    }, 500);

    return function stop() {
      clearInterval(interval);
    };
  });
  return store;
}
