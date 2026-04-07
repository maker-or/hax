import { create } from "@hax/ai";
import type {
	CreateClientOptionsType,
	ToolDefinitionType,
	UnifiedResponseType,
	UnifiedStreamEventPayload,
	appRequestShape,
} from "@hax/ai";
import * as z from "zod";

type PlaygroundClientConfigResult =
	| { ok: true; options: CreateClientOptionsType }
	| { ok: false; error: string };

let haxClient: ReturnType<typeof create> | undefined;
let cachedClientBaseUrl: string | undefined;

/**
 * This makes a timestamped trace message for debugging.
 */
function formatTrace(step: string, detail?: string): string {
	const now = new Date().toISOString();
	return detail ? `[${now}] ${step}: ${detail}` : `[${now}] ${step}`;
}

/**
 * This returns true when the URL host is WorkOS AuthKit’s browser-inaccessible API host (no CORS for SPAs).
 */
function isAuthKitAppHost(value: string): boolean {
	try {
		return new URL(value).hostname.endsWith(".authkit.app");
	} catch {
		return false;
	}
}

/**
 * This resolves the machine API base URL for chat completions.
 * `VITE_MACHINE_BASE_URL` / `VITE_WORKOS_TOKEN_ENDPOINT` often copy the AuthKit app URL; that host cannot be called from the browser, so we use the page origin and the Vite `/api` proxy to `apps/web` instead.
 * When unset in dev, uses the current page origin for the same reason.
 */
function resolvePlaygroundBaseUrl(): string {
	const explicit =
		import.meta.env.VITE_MACHINE_BASE_URL?.trim() ||
		import.meta.env.VITE_WORKOS_TOKEN_ENDPOINT?.trim() ||
		"";

	if (typeof globalThis.window !== "undefined") {
		if (!explicit || isAuthKitAppHost(explicit)) {
			if (explicit && isAuthKitAppHost(explicit)) {
				console.warn(
					"[playground] Machine base URL points at *.authkit.app, which blocks browser CORS. Using the page origin; ensure Vite proxies /api to apps/web (see vite.config.ts).",
				);
			}
			return globalThis.window.location.origin;
		}
		return explicit;
	}

	if (explicit && !isAuthKitAppHost(explicit)) {
		return explicit;
	}

	if (import.meta.env.DEV) {
		return "http://localhost:5173";
	}

	return "";
}

/**
 * This reads and validates the env vars we need to create the playground client.
 */
function getPlaygroundClientConfig(): PlaygroundClientConfigResult {
	const accessToken = import.meta.env.VITE_MACHINE_ACCESS_TOKEN?.trim() ?? "";
	const refreshToken = import.meta.env.VITE_MACHINE_REFRESH_TOKEN?.trim() ?? "";
	const clientId = import.meta.env.VITE_MACHINE_CLIENT_ID?.trim() ?? "";
	const clientSecret = import.meta.env.VITE_MACHINE_CLIENT_SECRET?.trim() ?? "";
	const baseUrl = resolvePlaygroundBaseUrl();

	const missing: string[] = [];

	if (!accessToken) {
		missing.push("VITE_MACHINE_ACCESS_TOKEN");
	}

	if (!refreshToken) {
		missing.push("VITE_MACHINE_REFRESH_TOKEN");
	}

	if (!clientId) {
		missing.push("VITE_MACHINE_CLIENT_ID");
	}

	if (!clientSecret) {
		missing.push("VITE_MACHINE_CLIENT_SECRET");
	}

	if (!baseUrl) {
		missing.push("VITE_MACHINE_BASE_URL (or VITE_WORKOS_TOKEN _ENDPOINT)");
	}

	if (missing.length > 0) {
		return {
			ok: false,
			error: `Playground client is not configured. Missing: ${missing.join(", ")}.`,
		};
	}

	return {
		ok: true,
		options: {
			accessToken,
			refreshToken,
			clientId,
			clientSecret,
			baseUrl,
		},
	};
}

const DEFAULT_MODEL: appRequestShape["model"] = "gpt-5.4";
const DEFAULT_SYSTEM_PROMPT = "You are a really helpful AI assistant.";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_RETRIES = 2;

/**
 * This is the only input we expect from the UI.
 */
export type PlaygroundRunInput = {
	latestMessage: string;
	model?: appRequestShape["model"];
};

/**
 * This is the rich callback set for wiring stream events to the UI.
 */
export type PlaygroundRequestHandlers = {
	onTrace?: (message: string) => void;
	onEvent?: (event: UnifiedStreamEventPayload) => void;
	onStart?: (
		event: Extract<UnifiedStreamEventPayload, { type: "start" }>,
	) => void;
	onTextStart?: (
		event: Extract<UnifiedStreamEventPayload, { type: "text_start" }>,
	) => void;
	onTextDelta?: (
		event: Extract<UnifiedStreamEventPayload, { type: "text_delta" }>,
	) => void;
	onTextEnd?: (
		event: Extract<UnifiedStreamEventPayload, { type: "text_end" }>,
	) => void;
	onThinkingStart?: (
		event: Extract<UnifiedStreamEventPayload, { type: "thinking_start" }>,
	) => void;
	onThinkingDelta?: (
		event: Extract<UnifiedStreamEventPayload, { type: "thinking_delta" }>,
	) => void;
	onThinkingEnd?: (
		event: Extract<UnifiedStreamEventPayload, { type: "thinking_end" }>,
	) => void;
	onToolCallStart?: (
		event: Extract<UnifiedStreamEventPayload, { type: "toolcall_start" }>,
	) => void;
	onToolCallDelta?: (
		event: Extract<UnifiedStreamEventPayload, { type: "toolcall_delta" }>,
	) => void;
	onToolCallEnd?: (
		event: Extract<UnifiedStreamEventPayload, { type: "toolcall_end" }>,
	) => void;
	onApprovalRequired?: (
		event: Extract<UnifiedStreamEventPayload, { type: "approval_required" }>,
	) => void;
	onDone?: (
		event: Extract<UnifiedStreamEventPayload, { type: "done" }>,
	) => void;
	onError?: (
		event: Extract<UnifiedStreamEventPayload, { type: "error" }>,
	) => void;
};

export const sum: ToolDefinitionType = {
	name: "sum",
	description: "the purpose of this tool is too add two numbers",
	requiresApproval: false,
	retrySafe: true,
	inputSchema: z.object({
		a: z.number(),
		b: z.number(),
	}),
	execute: async ({ a, b }: { a: number; b: number }) => {
		return a + b;
	},
};
/**
 * This builds the request here and forwards rich package stream events to UI callbacks.
 */
export async function runPlaygroundRequest(
	input: PlaygroundRunInput,
	handlers: PlaygroundRequestHandlers = {},
): Promise<UnifiedResponseType> {
	const emitTrace = (step: string, detail?: string) => {
		const message = formatTrace(step, detail);
		handlers.onTrace?.(message);
		console.debug(message);
	};

	emitTrace("run.start", `model=${input.model ?? DEFAULT_MODEL}`);

	const config = getPlaygroundClientConfig();
	emitTrace(
		"config.read",
		`hasAccessToken=${config.ok || !config.error.includes("VITE_MACHINE_ACCESS_TOKEN")}`,
	);

	if (!config.ok) {
		emitTrace("config.invalid", config.error);
		throw new Error(config.error);
	}

	const nextBaseUrl = config.options.baseUrl;
	if (!haxClient || cachedClientBaseUrl !== nextBaseUrl) {
		emitTrace(
			"client.create",
			cachedClientBaseUrl !== nextBaseUrl && haxClient
				? "base URL changed; recreating @hax/ai client"
				: "creating new @hax/ai client",
		);
		haxClient = create(config.options);
		cachedClientBaseUrl = nextBaseUrl;
	} else {
		emitTrace("client.reuse", "reusing cached @hax/ai client");
	}

	const hax = haxClient;

	const request: appRequestShape = {
		provider: "openai-codex",
		model: input.model ?? DEFAULT_MODEL,
		system: DEFAULT_SYSTEM_PROMPT,
		stream: true,
		temperature: DEFAULT_TEMPERATURE,
		maxRetries: DEFAULT_MAX_RETRIES,
		tools: [sum],
		messages: [
			{
				role: "user",
				content: input.latestMessage,
				timestamp: Date.now(),
			},
		],
	};

	emitTrace(
		"request.built",
		`messages=${request.messages.length}, tools=${request.tools?.length ?? 0}`,
	);

	emitTrace("request.send", "calling hax.generate");
	const result = await hax.generate(request);
	emitTrace("response.received", `stream=${String(result.stream)}`);

	if (!result.stream) {
		emitTrace("response.batch", "non-stream response path");
		const doneEvent = {
			type: "done",
			reason: "stop",
			message: result.response,
		} as Extract<UnifiedStreamEventPayload, { type: "done" }>;
		handlers.onDone?.(doneEvent);
		emitTrace("run.done", "batch response returned");
		return result.response;
	}

	emitTrace("response.stream.start", "consuming stream events");
	for await (const event of result.events) {
		emitTrace("response.stream.event", event.type);
		handlers.onEvent?.(event);

		switch (event.type) {
			case "start":
				{
					handlers.onStart?.(event);
					console.log(event.partial);
				}

				break;
			case "text_start":
				{
					handlers.onTextStart?.(event);
					console.log(event.partial);
				}
				break;
			case "text_delta":
				emitTrace("response.stream.text_delta", `chars=${event.delta.length}`);
				handlers.onTextDelta?.(event);
				console.log(event.delta);
				break;
			case "text_end":
				handlers.onTextEnd?.(event);
				console.log(event.content);
				break;
			case "thinking_start":
				handlers.onThinkingStart?.(event);
				console.log(event.partial);
				break;
			case "thinking_delta":
				handlers.onThinkingDelta?.(event);
				console.log(event.delta);
				break;
			case "thinking_end":
				handlers.onThinkingEnd?.(event);
				console.log(event.content);

				break;
			case "toolcall_start":
				handlers.onToolCallStart?.(event);
				break;
			case "toolcall_delta":
				handlers.onToolCallDelta?.(event);
				break;
			case "toolcall_end":
				handlers.onToolCallEnd?.(event);
				break;
			case "approval_required":
				handlers.onApprovalRequired?.(event);
				break;
			case "done":
				handlers.onDone?.(event);
				emitTrace("run.done", "stream done event received");
				return event.message;
			case "error":
				handlers.onError?.(event);
				emitTrace("run.error", "stream error event received");
				return event.error;
			default:
				break;
		}
	}

	emitTrace("response.stream.final", "awaiting final response snapshot");
	const final = await result.final();
	emitTrace("run.done", "returned result.final()");
	return final;
}
