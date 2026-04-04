import { Effect, Array as EffectArray, pipe } from "effect";
import type {
	AttachmentContent,
	TextContent,
	ToolResultMessage,
	UserMessage,
	message,
} from "../../types.js";
import type {
	appRequestShape,
	assistantContentPart,
	codexFunctionTool,
	codexInputContent,
	codexRequestShape,
	fileInput,
	functionCallInputType,
	functionToolOutputType,
	imageInput,
	inputMessageType,
	textInput,
} from "./types.js";

const toTextContentPart = (content: TextContent): Effect.Effect<textInput> =>
	Effect.succeed({
		type: "input_text",
		text: content.text,
	});

const toAssistantTextPart = (text: string): assistantContentPart => ({
	type: "output_text",
	text,
});

/**
 * This turns an image attachment into the Codex image input shape.
 */
const toImageContentPart = (
	content: AttachmentContent,
): Effect.Effect<imageInput> => {
	switch (content.source.type) {
		case "base64":
			return Effect.succeed({
				type: "input_image",
				image_url: `data:${content.mimetype};base64,${content.source.data}`,
			});
		case "url":
			return Effect.succeed({
				type: "input_image",
				image_url: content.source.url,
			});
		case "file_id":
			return Effect.succeed({
				type: "input_image",
				file_id: content.source.fileId,
			});
	}
};

/**
 * This turns a non-image attachment into the Codex file input shape.
 */
const toFileContentPart = (
	content: AttachmentContent,
): Effect.Effect<fileInput> => {
	switch (content.source.type) {
		case "base64":
			return Effect.succeed({
				type: "input_file",
				file_data: content.source.data,
				...(content.filename ? { filename: content.filename } : {}),
			});
		case "url":
			return Effect.succeed({
				type: "input_file",
				file_url: content.source.url,
				...(content.filename ? { filename: content.filename } : {}),
			});
		case "file_id":
			return Effect.succeed({
				type: "input_file",
				file_id: content.source.fileId,
				...(content.filename ? { filename: content.filename } : {}),
			});
	}
};

/**
 * This picks the right Codex input shape for an attachment.
 */
const toAttachmentContentPart = (
	content: AttachmentContent,
): Effect.Effect<codexInputContent> =>
	content.kind === "image"
		? toImageContentPart(content)
		: toFileContentPart(content);

const collapseContent = (
	parts: ReadonlyArray<codexInputContent>,
): string | codexInputContent[] =>
	parts.length === 1 && parts[0]?.type === "input_text"
		? parts[0].text
		: [...parts];

const collapseAssistantContent = (
	parts: ReadonlyArray<assistantContentPart>,
): string | assistantContentPart[] =>
	parts.length === 1 && parts[0]?.type === "output_text"
		? parts[0].text
		: [...parts];

const serializeAssistantTextContent = (
	content: Extract<message, { role: "assistant" }>["content"],
): Effect.Effect<string | assistantContentPart[]> =>
	pipe(
		content.filter((entry) => entry.type !== "toolcall"),
		EffectArray.map((entry) => {
			switch (entry.type) {
				case "text":
					return Effect.succeed(toAssistantTextPart(entry.text));
				case "thinking":
					return Effect.succeed(toAssistantTextPart(entry.thinking));
			}
		}),
		Effect.all,
		Effect.map(collapseAssistantContent),
	);

/**
 * This turns one assistant tool call into the native Responses API function call item.
 */
const serializeAssistantToolCall = (
	entry: Extract<
		Extract<message, { role: "assistant" }>["content"][number],
		{ type: "toolcall" }
	>,
): functionCallInputType => ({
	type: "function_call",
	id: entry.id,
	call_id: entry.callId ?? entry.id,
	name: entry.name,
	arguments: JSON.stringify(entry.arguments),
});

const serializeUserContent = (
	userMessage: UserMessage,
): Effect.Effect<string | codexInputContent[]> => {
	if (typeof userMessage.content === "string") {
		return Effect.succeed(userMessage.content);
	}

	return pipe(
		userMessage.content,
		EffectArray.map((entry) => {
			switch (entry.type) {
				case "text":
					return toTextContentPart(entry);
				case "attachment":
					return toAttachmentContentPart(entry);
			}
		}),
		Effect.all,
		Effect.map(collapseContent),
	);
};

const serializeToolContent = (
	toolMessage: ToolResultMessage,
): Effect.Effect<string | codexInputContent[]> =>
	pipe(
		toolMessage.content,
		EffectArray.map((entry) => {
			switch (entry.type) {
				case "text":
					return toTextContentPart(entry);
				case "attachment":
					return toAttachmentContentPart(entry);
			}
		}),
		Effect.all,
		Effect.map(collapseContent),
	);

const serializeToolResultMessage = (
	toolMessage: ToolResultMessage,
): Effect.Effect<functionToolOutputType> =>
	pipe(
		serializeToolContent(toolMessage),
		Effect.map((content) => {
			const output =
				typeof content === "string"
					? content
					: JSON.stringify({
							content,
							toolName: toolMessage.toolName,
							isError: toolMessage.isError,
						});

			return {
				type: "function_call_output" as const,
				call_id: toolMessage.toolCallId,
				output,
			};
		}),
	);

const compileMessage = (
	item: message,
): Effect.Effect<ReadonlyArray<inputMessageType>> =>
	(() => {
		switch (item.role) {
			case "user":
				return pipe(
					serializeUserContent(item),
					Effect.map(
						(content) =>
							[
								{
									role: "user" as const,
									content,
								},
							] as const,
					),
				);
			case "assistant":
				return Effect.gen(function* () {
					const items: inputMessageType[] = [];
					const textEntries = item.content.filter(
						(entry) => entry.type !== "toolcall",
					);

					if (textEntries.length > 0) {
						const content = yield* serializeAssistantTextContent(item.content);
						items.push({
							role: "assistant" as const,
							content,
						});
					}

					for (const entry of item.content) {
						if (entry.type === "toolcall") {
							items.push(serializeAssistantToolCall(entry));
						}
					}

					return items;
				});
			case "tool":
				return pipe(
					serializeToolResultMessage(item),
					Effect.map((content) => [content] as const),
				);
		}
	})();

/**
 * This turns a public tool definition into the Codex function tool shape.
 */
const compileToolDefinition = (
	tool: NonNullable<appRequestShape["tools"]>[number],
): codexFunctionTool => ({
	type: "function",
	name: tool.name,
	description: tool.description,
	parameters: tool.inputSchema,
	strict: true,
});

export const compileRequest = (request: appRequestShape): codexRequestShape =>
	Effect.runSync(
		Effect.gen(function* () {
			const compiledMessages = yield* pipe(
				request.messages,
				EffectArray.map(compileMessage),
				Effect.all,
				Effect.map((items) => items.flat()),
			);

			return {
				model: request.model,
				// Upstream requires `instructions` always present (never omit / undefined).
				instructions: request.system ?? "",
				input: compiledMessages,
				...(request.tools?.length
					? {
							tools: request.tools.map(compileToolDefinition),
						}
					: {}),
				stream: request.stream,
				store: false,
			};
		}),
	);
