import { consumeUnifiedStream } from "./consume-unified-stream";
import type {
  UnifiedGenerateResult,
  UnifiedResponse,
} from "../types.ts";
import type { appRequestShape } from "../providers/openai-codex/types.ts";

export async function generate(
  request: appRequestShape,
  options: {
    endpoint: string;
    headers?: HeadersInit;
  },
): Promise<UnifiedGenerateResult> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Fetch implementation is required");
  }

  const { signal, ...serializableRequest } = request;
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");

  const response = await globalThis.fetch(options.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(serializableRequest),
    signal,
  });

  if (request.stream) {
    return consumeUnifiedStream(response);
  }

  if (!response.ok) {
    throw new Error(
      `Request failed with status ${response.status}: ${await response.text()}`,
    );
  }

  const finalResponse = (await response.json()) as UnifiedResponse;
  return {
    stream: false,
    response: finalResponse,
  };
}
