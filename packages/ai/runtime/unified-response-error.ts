import type { UnifiedResponse } from "../types.ts";

/**
 * This builds a minimal `UnifiedResponse` for machine or client stream `error` frames (pi-mono uses `error: AssistantMessage`; we use `error: UnifiedResponse`).
 */
export function unifiedResponseForStreamError(
	message: string,
): UnifiedResponse {
	return {
		status: "failed",
		content: [],
		toolCalls: [],
		approvals: [],
		warnings: [],
		finishReason: "error",
		errorMessage: message,
	};
}
