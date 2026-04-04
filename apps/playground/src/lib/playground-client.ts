import {
	type AppRequestShapeType,
	type AttachmentContentType,
	type MessageType,
	type UnifiedResponseType,
	create,
} from "@hax/ai";

export type FinalResponse = UnifiedResponseType;

export const DEFAULT_PROMPT = "Write a haiku about validating AI DX.";
export const DEFAULT_SYSTEM_PROMPT =
	"You are a concise assistant helping validate the Hax AI client DX.";
export const DEFAULT_HISTORY_JSON = "[]";

/**
 * This is one row in the playground activity timeline (run, model step, tools, etc.).
 */
export type AgentTimelineItem = {
	id: string;
	kind: "run" | "model" | "tool-call" | "approval" | "tool-result" | "final";
	title: string;
	detail?: string;
	input?: unknown;
	output?: unknown;
};

/**
 * This is what the UI shows when the machine asks to approve a tool call.
 */
export type PlaygroundApprovalRequest = {
	toolName: string;
	input: unknown;
};

/**
 * This is the caller’s answer to an approval prompt in the playground.
 */
export type PlaygroundApprovalDecision = {
	approved: boolean;
	reason?: string;
};

/**
 * Holds machine API settings loaded from Vite env. Used only for local playground runs.
 * Expects `VITE_*` variables in `apps/playground/src/.env`.
 */
export type PlaygroundConfig = {
	baseUrl: string;
	accessToken: string;
	refreshToken: string;
	clientId: string;
	clientSecret: string;
	envError: string;
};

export type RunPlaygroundRequestOptions = {
	prompt: string;
	systemPrompt: string;
	stream: boolean;
	files: File[];
	historyJson: string;
	appendPromptAsUserMessage: boolean;
	onTextDelta?: (delta: string) => void;
	onTimelineEvent?: (event: AgentTimelineItem) => void;
	requestApproval?: (
		request: PlaygroundApprovalRequest,
	) => Promise<PlaygroundApprovalDecision>;
};

export type RunPlaygroundRequestResult = {
	finalResponse: FinalResponse;
	output: string;
};

const DEFAULT_LOCAL_MACHINE_BASE_URL = "http://localhost:3000";

function nextTimelineId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Resolves the machine API base URL for the playground.
 * In the browser, defaults to the current origin so requests go through the Vite
 * dev proxy (`/api` → `http://localhost:3000`) and avoid cross-origin CORS failures.
 * Override with `VITE_MACHINE_BASE_URL` when pointing at a remote deployment.
 */
function resolvePlaygroundBaseUrl(): string {
	const fromEnv = import.meta.env.VITE_MACHINE_BASE_URL?.trim();
	if (fromEnv) {
		return fromEnv;
	}

	if (typeof window !== "undefined" && window.location.origin) {
		return window.location.origin;
	}

	return DEFAULT_LOCAL_MACHINE_BASE_URL;
}

/**
 * Reads playground env and returns config for `create()`.
 * Returns `envError` listing any missing required variables (local testing only).
 */
export function getPlaygroundConfig(): PlaygroundConfig {
	const baseUrl = resolvePlaygroundBaseUrl();
	const accessToken = import.meta.env.VITE_MACHINE_ACCESS_TOKEN?.trim() ?? "";
	const refreshToken = import.meta.env.VITE_MACHINE_REFRESH_TOKEN?.trim() ?? "";
	const clientId = import.meta.env.VITE_MACHINE_CLIENT_ID?.trim() ?? "";
	const clientSecret = import.meta.env.VITE_MACHINE_CLIENT_SECRET?.trim() ?? "";

	const missing = (
		[
			["VITE_MACHINE_ACCESS_TOKEN", accessToken],
			["VITE_MACHINE_REFRESH_TOKEN", refreshToken],
			["VITE_MACHINE_CLIENT_ID", clientId],
			["VITE_MACHINE_CLIENT_SECRET", clientSecret],
		] as const
	)
		.filter(([, value]) => !value)
		.map(([name]) => name);

	const envError =
		missing.length > 0
			? `Missing required env in apps/playground/src/.env: ${missing.join(", ")}. Optional: VITE_MACHINE_BASE_URL (otherwise the app uses the current origin and the Vite proxy to ${DEFAULT_LOCAL_MACHINE_BASE_URL}).`
			: "";

	return {
		baseUrl,
		accessToken,
		refreshToken,
		clientId,
		clientSecret,
		envError,
	};
}

export function stringifyJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

/**
 * This builds a readable JSON preview of the request the playground will send (no file base64).
 */
export function getPlaygroundRequestPreview(options: {
	systemPrompt: string;
	prompt: string;
	files: File[];
	historyJson: string;
	appendPromptAsUserMessage: boolean;
}): string {
	let history: unknown;
	try {
		history = JSON.parse(options.historyJson) as unknown;
	} catch {
		history = "(invalid JSON)";
	}

	return stringifyJson({
		provider: "openai-codex",
		model: "gpt-5.4",
		system: options.systemPrompt,
		stream: "(chosen when you run)",
		temperature: 0.2,
		maxRetries: 2,
		history,
		appendPromptAsUserMessage: options.appendPromptAsUserMessage,
		prompt: options.prompt,
		attachments: options.files.map((file) => ({
			name: file.name,
			type: file.type,
			size: file.size,
		})),
	});
}

export function getDisplayText(response: FinalResponse): string {
	if (typeof response.text === "string" && response.text.length > 0) {
		return response.text;
	}

	if (response.object !== undefined) {
		return stringifyJson(response.object);
	}

	return "";
}

export function maskToken(token: string): string {
	if (token.length <= 8) {
		return "configured";
	}

	return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * This reads a browser file and returns the base64 payload without the data URL prefix.
 */
async function readFileAsBase64(file: File): Promise<string> {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = () => {
			if (typeof reader.result !== "string") {
				reject(new Error(`Could not read ${file.name} as a data URL.`));
				return;
			}

			resolve(reader.result);
		};

		reader.onerror = () => {
			reject(reader.error ?? new Error(`Could not read ${file.name}.`));
		};

		reader.readAsDataURL(file);
	});

	const commaIndex = dataUrl.indexOf(",");
	if (commaIndex === -1) {
		throw new Error(`Could not parse the encoded content for ${file.name}.`);
	}

	return dataUrl.slice(commaIndex + 1);
}

/**
 * This maps a browser file into the attachment kind we use in the unified request.
 */
function getAttachmentKind(file: File): AttachmentContentType["kind"] {
	if (file.type.startsWith("image/")) {
		return "image";
	}

	if (file.type.startsWith("audio/")) {
		return "audio";
	}

	if (file.type.startsWith("video/")) {
		return "video";
	}

	return "document";
}

/**
 * This turns browser files into unified attachment content parts for the request.
 */
async function createAttachmentContents(
	files: File[],
): Promise<AttachmentContentType[]> {
	return Promise.all(
		files.map(async (file) => ({
			type: "attachment",
			kind: getAttachmentKind(file),
			mimetype: file.type || "application/octet-stream",
			filename: file.name,
			source: {
				type: "base64",
				data: await readFileAsBase64(file),
			},
		})),
	);
}

function parseHistoryMessages(json: string): MessageType[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json) as unknown;
	} catch {
		throw new Error("History JSON must be valid JSON.");
	}

	if (!Array.isArray(parsed)) {
		throw new Error("History JSON must be a JSON array of messages.");
	}

	return parsed as MessageType[];
}

async function consumeTextStream(
	stream: ReadableStream<string>,
	onChunk: (delta: string) => void,
): Promise<void> {
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			onChunk(value);
		}
	} finally {
		reader.releaseLock();
	}
}

export async function runPlaygroundRequest(
	options: RunPlaygroundRequestOptions,
): Promise<RunPlaygroundRequestResult> {
	const {
		prompt,
		systemPrompt,
		stream,
		files,
		historyJson,
		appendPromptAsUserMessage,
		onTextDelta,
		onTimelineEvent,
	} = options;

	const emit = (event: Omit<AgentTimelineItem, "id">) => {
		onTimelineEvent?.({ ...event, id: nextTimelineId() });
	};

	const config = getPlaygroundConfig();

	if (config.envError) {
		throw new Error(config.envError);
	}

	emit({ kind: "run", title: "Run started" });

	const historyMessages = parseHistoryMessages(historyJson);
	const attachments = await createAttachmentContents(files);
	const trimmedPrompt = prompt.trim();

	const messageContent:
		| string
		| readonly (
				| AttachmentContentType
				| { readonly type: "text"; readonly text: string }
		  )[] =
		attachments.length === 0
			? trimmedPrompt
			: [
					...(trimmedPrompt
						? ([{ type: "text" as const, text: trimmedPrompt }] as const)
						: []),
					...attachments,
				];

	const messages: MessageType[] = [...historyMessages];

	if (appendPromptAsUserMessage && (trimmedPrompt || attachments.length > 0)) {
		messages.push({
			role: "user",
			content: messageContent,
		});
	}

	if (messages.length === 0) {
		throw new Error(
			"Add at least one message: enable “Append message as last user turn” or put messages in History JSON.",
		);
	}

	const request = {
		provider: "openai-codex",
		model: "gpt-5.4",
		system: systemPrompt,
		stream,
		temperature: 0.2,
		maxRetries: 2,
		messages,
	} satisfies AppRequestShapeType;

	const client = create({
		accessToken: config.accessToken,
		refreshToken: config.refreshToken,
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		baseUrl: config.baseUrl,
	});

	emit({ kind: "model", title: "Calling model", detail: request.model });

	const result = await client.generate(request);

	if (stream) {
		if (!result.stream) {
			throw new Error("Expected a streaming response.");
		}

		if (!result.textStream) {
			throw new Error("Streaming response did not provide a text stream.");
		}

		await consumeTextStream(result.textStream, (delta) => {
			onTextDelta?.(delta);
		});

		const finalResponse = await result.final();
		emit({
			kind: "final",
			title: "Completed",
			detail: finalResponse.status,
		});
		return {
			finalResponse,
			output: getDisplayText(finalResponse),
		};
	}

	if (result.stream) {
		throw new Error("Expected a batch response.");
	}

	const finalResponse = result.response;
	emit({
		kind: "final",
		title: "Completed",
		detail: finalResponse.status,
	});
	return {
		finalResponse,
		output: getDisplayText(finalResponse),
	};
}
