import { createUnifiedResponseStream } from "../runtime/unified-response-stream.js";
import type {
	UnifiedResponse,
	UnifiedResponseStreamController,
	UnifiedResponseStreamingResult,
} from "../types.js";

type UnifiedSseFrame = {
	event: string;
	data: string;
};

export function consumeUnifiedStream(
	response: Response,
): UnifiedResponseStreamingResult {
	const stream = createUnifiedResponseStream();
	void processUnifiedStream(response, stream.controller);
	return stream.result;
}

async function processUnifiedStream(
	response: Response,
	controller: UnifiedResponseStreamController,
): Promise<void> {
	try {
		await assertReadableResponse(response);
		const body = response.body;
		if (body === null) {
			throw new Error("Streaming response body is missing");
		}

		for await (const frame of parseUnifiedSse(body)) {
			applyUnifiedEvent(frame, controller);
		}
	} catch (cause) {
		controller.error(cause);
	}
}

async function* parseUnifiedSse(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<UnifiedSseFrame, void, void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	const parseFrame = (rawFrame: string): UnifiedSseFrame | undefined => {
		const frame = rawFrame.replace(/\r\n/g, "\n");
		const lines = frame.split("\n");
		let event = "message";
		const dataLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith("event:")) {
				event = line.slice(6).trim();
			} else if (line.startsWith("data:")) {
				dataLines.push(line.slice(5).trim());
			}
		}

		if (dataLines.length === 0) {
			return undefined;
		}

		const data = dataLines.join("\n");
		if (data === "[DONE]") {
			return undefined;
		}

		return { event, data };
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });

			while (true) {
				const separatorIndex = buffer.indexOf("\n\n");
				if (separatorIndex === -1) {
					break;
				}

				const rawFrame = buffer.slice(0, separatorIndex);
				buffer = buffer.slice(separatorIndex + 2);

				const parsed = parseFrame(rawFrame);
				if (parsed !== undefined) {
					yield parsed;
				}
			}
		}

		buffer += decoder.decode();
		const trailingFrame = buffer.trim();
		if (trailingFrame.length > 0) {
			const parsed = parseFrame(trailingFrame);
			if (parsed !== undefined) {
				yield parsed;
			}
		}
	} finally {
		reader.releaseLock();
	}
}

function applyUnifiedEvent(
	frame: UnifiedSseFrame,
	controller: UnifiedResponseStreamController,
): void {
	switch (frame.event) {
		case "text": {
			const payload = JSON.parse(frame.data) as { delta?: unknown };
			controller.pushText(
				typeof payload.delta === "string" ? payload.delta : "",
			);
			return;
		}
		case "final": {
			const payload = JSON.parse(frame.data) as UnifiedResponse;
			controller.complete(payload);
			return;
		}
		case "error": {
			const payload = JSON.parse(frame.data) as { message?: unknown };
			controller.error(
				new Error(
					typeof payload.message === "string"
						? payload.message
						: "Unified stream failed",
				),
			);
			return;
		}
		default:
			return;
	}
}

async function assertReadableResponse(response: Response): Promise<void> {
	if (!response.ok) {
		const body = await response
			.clone()
			.text()
			.catch(() => "");
		throw new Error(
			body.length > 0
				? `Streaming request failed with status ${response.status}: ${body}`
				: `Streaming request failed with status ${response.status}`,
		);
	}

	if (response.body === null) {
		throw new Error("Streaming response body is missing");
	}
}
