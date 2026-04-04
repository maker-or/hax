import type {
	CreateUnifiedResponseStreamResult,
	UnifiedResponse,
	UnifiedResponseStreamController,
} from "../types.js";

export function createUnifiedResponseStream(): CreateUnifiedResponseStreamResult {
	let textController: ReadableStreamDefaultController<string> | undefined;
	let settled = false;

	let resolveFinal!: (response: UnifiedResponse) => void;
	let rejectFinal!: (cause?: unknown) => void;

	const finalPromise = new Promise<UnifiedResponse>((resolve, reject) => {
		resolveFinal = resolve;
		rejectFinal = reject;
	});

	const textStream = new ReadableStream<string>({
		start(controller) {
			textController = controller;
		},
	});

	const controller: UnifiedResponseStreamController = {
		pushText(delta) {
			if (settled || delta.length === 0 || textController === undefined) {
				return;
			}

			textController.enqueue(delta);
		},

		complete(response) {
			if (settled) {
				return;
			}

			settled = true;
			textController?.close();
			resolveFinal(response);
		},

		error(cause) {
			if (settled) {
				return;
			}

			settled = true;
			textController?.error(cause);
			rejectFinal(cause);
		},
	};

	return {
		result: {
			stream: true,
			textStream,
			final() {
				return finalPromise;
			},
		},
		controller,
	};
}
