import { AsyncSignal, AsyncState, Signal } from '@holochain-open-dev/signals';

export function pollingSignal<T>(
	pollingRequest: (currentState: T | undefined) => Promise<T>,
	pollingIntervalMs = 1000,
): AsyncSignal<T> {
	let interval: any = undefined;
	const signal = new AsyncState<T>(
		{
			status: 'pending',
		},
		{
			[Signal.subtle.watched]: () => {
				interval = setInterval(async () => {
					let currentValue: T | undefined;
					const currentResult = signal.get();
					if (currentResult.status === 'completed')
						currentValue = currentResult.value;
					const value = await pollingRequest(currentValue);
					signal.set({
						status: 'completed',
						value,
					});
				}, pollingIntervalMs);
			},
			[Signal.subtle.unwatched]: () => {
				signal.set({
					status: 'pending',
				});
				clearInterval(interval);
				interval = undefined;
			},
		},
	);

	return signal;
}
