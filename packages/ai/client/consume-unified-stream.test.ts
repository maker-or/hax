import { describe, expect, test } from "bun:test";
import { consumeUnifiedStream } from "./consume-unified-stream.ts";
import type { UnifiedResponseType } from "../index.ts";

function createSseResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
    },
    ...init,
  });
}

async function readTextStream(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

describe("consumeUnifiedStream", () => {
  test("reconstructs textStream and final response from unified SSE", async () => {
    const finalResponse: UnifiedResponseType = {
      text: "Hello world",
      content: [{ type: "text", text: "Hello world" }],
      toolCalls: [],
      toolResults: [],
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      finishReason: "stop",
      providerMetadata: {
        provider: "openai-codex",
        responseId: "resp_123",
        messageId: "msg_123",
        model: "gpt-5.4",
      },
      warnings: [],
    };

    const response = createSseResponse(
      [
        'event: text',
        'data: {"delta":"Hello "}',
        "",
        'event: text',
        'data: {"delta":"world"}',
        "",
        "event: final",
        `data: ${JSON.stringify(finalResponse)}`,
        "",
      ].join("\n"),
    );

    const result = consumeUnifiedStream(response);
    const chunks = await readTextStream(result.textStream);
    const final = await result.final();

    expect(result.stream).toBe(true);
    expect(chunks).toEqual(["Hello ", "world"]);
    expect(final).toEqual(finalResponse);
  });

  test("rejects final and errors the stream when the machine sends an error event", async () => {
    const response = createSseResponse(
      [
        "event: error",
        'data: {"message":"machine failed"}',
        "",
      ].join("\n"),
    );

    const result = consumeUnifiedStream(response);
    const textError = readTextStream(result.textStream).then(
      () => null,
      (error) => error,
    );
    const finalError = result.final().then(
      () => null,
      (error) => error,
    );

    const textFailure = await textError;
    const finalFailure = await finalError;

    expect(textFailure).toBeInstanceOf(Error);
    expect((textFailure as Error).message).toContain("machine failed");
    expect(finalFailure).toBeInstanceOf(Error);
    expect((finalFailure as Error).message).toContain("machine failed");
  });
});
