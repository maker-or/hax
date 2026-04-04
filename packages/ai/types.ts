import { Schema } from "effect";

export const Provider = Schema.Literal(
	"openai-codex",
	"anthropic",
	"github-copilot",
	"google-gemini-cli",
);

/**
 * This tells us which transport the client uses for the run.
 */
export const Transport = Schema.Literal("sse", "websocket");

const StopReason = Schema.Literal(
	"stop",
	"max_tokens",
	"toolUse",
	"error",
	"aborted",
);

const cost = Schema.Struct({
	input: Schema.Number,
	output: Schema.Number,
	cacheRead: Schema.Number,
	cacheWrite: Schema.Number,
});

/**
 * This tells us what kind of attachment we are sending in the message.
 */
export const AttachmentKind = Schema.Literal(
	"image",
	"audio",
	"video",
	"document",
);

/**
 * This is the source of the attachment that we are sending in the message.
 */
export const AttachmentSource = Schema.Union(
	Schema.Struct({
		type: Schema.Literal("base64"),
		data: Schema.String,
	}),
	Schema.Struct({
		type: Schema.Literal("url"),
		url: Schema.String,
	}),
	Schema.Struct({
		type: Schema.Literal("file_id"),
		fileId: Schema.String,
	}),
);

/**
 * This is the attachment content that we are sending in the message.
 */
export const AttachmentContent = Schema.Struct({
	type: Schema.Literal("attachment"),
	kind: AttachmentKind,
	mimetype: Schema.String,
	filename: Schema.optional(Schema.String),
	source: AttachmentSource,
});

const InputType = Schema.Literal("text", "attachment");

/**
 * This is the shape that things need to be in while defining the models for the providers in sdk
 */
export const BaseModel = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	provider: Provider,
	reasoning: Schema.Boolean,
	baseUrl: Schema.URL,
	input: Schema.Array(InputType),
	cost: cost,
	contextWindow: Schema.Number,
	maxTokens: Schema.Number,
});

/**
 * This is a text content block that can be used in messages.
 */
export const TextContent = Schema.Struct({
	type: Schema.Literal("text"),
	text: Schema.String,
	textSignature: Schema.optional(Schema.String),
});

/**
 * This is a reasoning content block that can be used in assistant messages.
 */
export const ThinkingContent = Schema.Struct({
	type: Schema.Literal("thinking"),
	thinking: Schema.String,
	thinkingSignature: Schema.optional(Schema.String),
	redacted: Schema.optional(Schema.String),
});

/**
 * This is the tool call shape that assistant messages keep in history.
 * For OpenAI Responses, `id` is the output item id (`fc_…`) you must send back as `function_call.id`,
 * and `callId` is the correlation id (`call_…`) that pairs with `function_call_output.call_id`.
 */
export const Toolcall = Schema.Struct({
	type: Schema.Literal("toolcall"),
	id: Schema.String,
	callId: Schema.optional(Schema.String),
	name: Schema.String,
	arguments: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	thoughtSignature: Schema.optional(Schema.String),
});

/**
 * This is the token and cost usage that we expose across providers.
 */
export const Usage = Schema.Struct({
	input: Schema.Number,
	output: Schema.Number,
	cacheRead: Schema.Number,
	cacheWrite: Schema.Number,
	totalTokens: Schema.Number,
	cost: Schema.Struct({
		input: Schema.Number,
		output: Schema.Number,
		cacheRead: Schema.Number,
		cacheWrite: Schema.Number,
		total: Schema.Number,
	}),
});

export const content = Schema.Union(TextContent, AttachmentContent);

/**
 * This is a user message that we send to the model.
 * `timestamp` is optional for new requests; add it when you need stable ordering in stored history.
 */
export const UserMessage = Schema.Struct({
	role: Schema.Literal("user"),
	content: Schema.Union(Schema.Array(content), Schema.String),
	timestamp: Schema.optional(Schema.Number),
});

/**
 * This is an assistant message that callers can keep in history for agent loops.
 * `timestamp` is optional when you only need the model payload shape; set it when persisting history.
 */
export const baseAssistantMessage = Schema.Struct({
	role: Schema.Literal("assistant"),
	content: Schema.Array(Schema.Union(TextContent, ThinkingContent, Toolcall)),
	usage: Usage,
	provider: Provider,
	stopReason: StopReason,
	errorMessage: Schema.optional(Schema.String),
	timestamp: Schema.optional(Schema.Number),
});

/**
 * This is a tool message that callers can keep in history for agent loops.
 * `timestamp` is optional for the same reason as user and assistant messages.
 */
export const ToolResultMessage = Schema.Struct({
	role: Schema.Literal("tool"),
	toolCallId: Schema.String,
	toolName: Schema.String,
	content: Schema.Array(Schema.Union(TextContent, AttachmentContent)),
	isError: Schema.Boolean,
	timestamp: Schema.optional(Schema.Number),
});

/**
 * This is the message union that callers pass back for continued runs.
 */
export const message = Schema.Union(
	UserMessage,
	baseAssistantMessage,
	ToolResultMessage,
);

/**
 * This tells us why a model run finished.
 */
export const ResponseFinishReason = Schema.Literal(
	"stop",
	"length",
	"tool-call",
	"content-filter",
	"error",
	"abort",
);

/**
 * This tells us the current status of a run.
 */
export const RunStatus = Schema.Literal(
	"queued",
	"in_progress",
	"requires_action",
	"completed",
	"failed",
	"aborted",
);

/**
 * This tells us what should happen when approval is rejected.
 */
export const ApprovalRejectionMode = Schema.Literal(
	"return_tool_error",
	"abort_run",
);

/**
 * This tells us the approval status for one tool call.
 */
export const ApprovalStatus = Schema.Literal("pending", "approved", "rejected");

/**
 * This is the request that the UI can use to ask the user for approval.
 */
export const ApprovalRequest = Schema.Struct({
	id: Schema.String,
	runId: Schema.String,
	toolCallId: Schema.String,
	toolName: Schema.String,
	input: Schema.Unknown,
	status: ApprovalStatus,
	rejectionMode: ApprovalRejectionMode,
	reason: Schema.optional(Schema.String),
	metadata: Schema.optional(
		Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	),
});

/**
 * This is the public tool definition that callers register with the SDK.
 * The schemas stay unknown here because each app can bring its own schema object.
 * The execute function runs the tool locally when the caller wants to handle tool calls.
 */
export const ToolDefinition = Schema.Struct({
	name: Schema.String,
	description: Schema.String,
	inputSchema: Schema.Unknown,
	outputSchema: Schema.optional(Schema.Unknown),
	execute: Schema.optional(Schema.Any),
	retrySafe: Schema.optional(Schema.Boolean),
	requiresApproval: Schema.optional(Schema.Boolean),
	rejectionMode: Schema.optional(ApprovalRejectionMode),
	metadata: Schema.optional(
		Schema.Record({ key: Schema.String, value: Schema.Unknown }),
	),
});

/**
 * This is the shared request shape for callers that want to send full message history.
 */
export const requestShape = Schema.Struct({
	provider: Provider,
	system: Schema.String,
	stream: Schema.Boolean,
	messages: Schema.Array(message),
	tools: Schema.optional(Schema.Array(ToolDefinition)),
	temperature: Schema.Number,
	maxRetries: Schema.Number,
	signal: Schema.optional(Schema.instanceOf(AbortSignal)),
});

/**
 * This is the text part that callers usually render in the UI.
 */
export const ResponseTextPart = Schema.Struct({
	type: Schema.Literal("text"),
	text: Schema.String,
});

/**
 * This is the reasoning part that callers can render in advanced UIs.
 */
export const ResponseReasoningPart = Schema.Struct({
	type: Schema.Literal("reasoning"),
	text: Schema.String,
});

/**
 * This is the tool call part that callers can use for approval and traces.
 * `id` matches the provider output item id (OpenAI: `fc_…`); `callId` is the OpenAI `call_…` id for tool results.
 */
export const ResponseToolCallPart = Schema.Struct({
	type: Schema.Literal("tool-call"),
	id: Schema.String,
	callId: Schema.optional(Schema.String),
	name: Schema.String,
	arguments: Schema.Unknown,
	approval: Schema.optional(ApprovalRequest),
	providerMetadata: Schema.optional(Schema.Unknown),
});

/**
 * This is the ordered output part union that callers can use to build custom UIs.
 */
export const ResponseContentPart = Schema.Union(
	ResponseTextPart,
	ResponseReasoningPart,
	ResponseToolCallPart,
);

/**
 * This is the metadata that we expose from the provider in a safe shape.
 */
export const ProviderMetadata = Schema.Struct({
	provider: Provider,
	requestId: Schema.optional(Schema.String),
	responseId: Schema.optional(Schema.String),
	messageId: Schema.optional(Schema.String),
	model: Schema.optional(Schema.String),
	rawFinishReason: Schema.optional(Schema.String),
});

/**
 * This is the single response shape that callers can trust from the SDK.
 * It keeps the final text, visible content parts, tool calls, and request status.
 */
export const UnifiedResponse = Schema.Struct({
	status: RunStatus,
	text: Schema.optional(Schema.String),
	object: Schema.optional(Schema.Unknown),
	content: Schema.Array(ResponseContentPart),
	toolCalls: Schema.Array(ResponseToolCallPart),
	approvals: Schema.Array(ApprovalRequest),
	usage: Schema.optional(Usage),
	finishReason: Schema.optional(ResponseFinishReason),
	providerMetadata: Schema.optional(ProviderMetadata),
	warnings: Schema.Array(Schema.String),
	errorMessage: Schema.optional(Schema.String),
});

export type Provider = typeof Provider.Type;
export type Transport = typeof Transport.Type;
export type cost = typeof cost.Type;
export type AttachmentKind = typeof AttachmentKind.Type;
export type AttachmentSource = typeof AttachmentSource.Type;
export type InputType = typeof InputType.Type;
export type BaseModel = typeof BaseModel.Type;
export type requestShape = typeof requestShape.Type;
export type TextContent = typeof TextContent.Type;
export type AttachmentContent = typeof AttachmentContent.Type;
export type ThinkingContent = typeof ThinkingContent.Type;
export type Toolcall = typeof Toolcall.Type;
export type Usage = typeof Usage.Type;
export type content = typeof content.Type;
export type UserMessage = typeof UserMessage.Type;
export type baseAssistantMessage = typeof baseAssistantMessage.Type;
export type ToolResultMessage = typeof ToolResultMessage.Type;
export type message = typeof message.Type;
export type ResponseFinishReason = typeof ResponseFinishReason.Type;
export type RunStatus = typeof RunStatus.Type;
export type ApprovalRejectionMode = typeof ApprovalRejectionMode.Type;
export type ApprovalStatus = typeof ApprovalStatus.Type;
export type ApprovalRequest = typeof ApprovalRequest.Type;
export type ToolDefinition = typeof ToolDefinition.Type;
export type ResponseTextPart = typeof ResponseTextPart.Type;
export type ResponseReasoningPart = typeof ResponseReasoningPart.Type;
export type ResponseToolCallPart = typeof ResponseToolCallPart.Type;
export type ResponseContentPart = typeof ResponseContentPart.Type;
export type ProviderMetadata = typeof ProviderMetadata.Type;
export type UnifiedResponse = typeof UnifiedResponse.Type;

export type UnifiedResponseStreamingResult = {
	readonly stream: true;
	readonly textStream: ReadableStream<string>;
	final(): Promise<UnifiedResponse>;
};

export type UnifiedResponseBatchResult = {
	readonly stream: false;
	readonly response: UnifiedResponse;
};

export type UnifiedGenerateResult =
	| UnifiedResponseBatchResult
	| UnifiedResponseStreamingResult;

export type UnifiedResponseStreamController = {
	pushText(delta: string): void;
	complete(response: UnifiedResponse): void;
	error(cause?: unknown): void;
};

export type CreateUnifiedResponseStreamResult = {
	result: UnifiedResponseStreamingResult;
	controller: UnifiedResponseStreamController;
};

/**
 * These credentials are split between user tokens and application credentials.
 */
export type CreateClientOptions = {
	accessToken: string;
	refreshToken: string;
	clientId: string;
	clientSecret: string;
	baseUrl?: string;
};

/**
 * This is the function shape that runs a tool with decoded input.
 */
export type ToolExecute = (input: unknown) => Promise<unknown> | unknown;

/**
 * This is the runtime tool shape that callers usually work with in apps.
 */
export type Tool = Omit<ToolDefinition, "execute"> & {
	execute?: ToolExecute;
};
