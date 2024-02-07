import { readable, Readable } from 'svelte/store';

export function pollingStore<T>(
  startValue: T,
  pollingRequest: (currentState: T) => Promise<T>
): Readable<T> {
  const store = readable(startValue, (set) => {
    let value: T = startValue;

    const interval = setInterval(async () => {
      value = await pollingRequest(value);
      set(value);
    }, 1000);

    return function stop() {
      clearInterval(interval);
    };
  });
  return store;
}
