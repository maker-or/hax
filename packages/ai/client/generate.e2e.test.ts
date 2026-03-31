import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import { generate } from "./generate.ts";
import type { AppRequestShapeType } from "../index.ts";

type AxiosArgs = [string, unknown?, Record<string, unknown>?];
type AxiosResponse = {
  status: number;
  data: unknown;
  headers: Record<string, string | undefined>;
};

let postImpl: (...args: AxiosArgs) => Promise<AxiosResponse>;
let getImpl: (url: string, config?: Record<string, unknown>) => Promise<AxiosResponse>;

const axiosPost = mock((...args: AxiosArgs) => postImpl(...args));
const axiosGet = mock((url: string, config?: Record<string, unknown>) =>
  getImpl(url, config),
);

mock.module("axios", () => {
  const axios = {
    post: (...args: AxiosArgs) => axiosPost(...args),
    get: (url: string, config?: Record<string, unknown>) =>
      axiosGet(url, config),
  };

  return {
    default: axios,
    post: axios.post,
    get: axios.get,
  };
});

const { handleRequest } = await import("../../../apps/web/app/machine/service.ts");

const request: AppRequestShapeType = {
  provider: "openai-codex",
  model: "gpt-5.4",
  system: "Be concise.",
  stream: true,
  temperature: 0.2,
  maxRetries: 2,
  messages: [
    {
      role: "user",
      content: "Say hello.",
      timestamp: 1,
    },
  ],
};

function codexSseResponse(args: {
  responseId: string;
  messageId: string;
  model: string;
  delta: string;
}): string {
  return [
    `data: ${JSON.stringify({
      type: "response.created",
      response: {
        id: args.responseId,
        model: args.model,
        status: "in_progress",
      },
    })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.output_item.added",
      item: {
        id: args.messageId,
        type: "message",
      },
    })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.output_text.delta",
      delta: args.delta,
    })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.output_text.done",
    })}`,
    "",
    `data: ${JSON.stringify({
      type: "response.completed",
      response: {
        id: args.responseId,
        model: args.model,
        status: "completed",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      },
    })}`,
    "",
  ].join("\n");
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

beforeEach(() => {
  axiosPost.mockClear();
  axiosGet.mockClear();
  postImpl = async () => {
    throw new Error("unconfigured axios.post mock");
  };
  getImpl = async () => {
    throw new Error("unconfigured axios.get mock");
  };
});

describe("generate end-to-end", () => {
  test("streams text and resolves final response through the machine layer", async () => {
    postImpl = async (url) => {
      if (url === "https://cautious-platypus-49.convex.site/verify-api-key") {
        return {
          status: 200,
          data: { valid: true, userId: "user-1" },
          headers: {},
        };
      }

      if (url === "https://chatgpt.com/backend-api/codex/responses") {
        return {
          status: 200,
          data: codexSseResponse({
            responseId: "resp_e2e_1",
            messageId: "msg_e2e_1",
            model: "gpt-5.4",
            delta: "Hello from e2e",
          }),
          headers: {
            "content-type": "text/event-stream",
          },
        };
      }

      throw new Error(`unexpected post url: ${url}`);
    };

    getImpl = async () => ({
      status: 200,
      data: {
        _id: "cred_1",
        _creationTime: 1,
        userId: "user-1",
        orgId: "org_1",
        provider: "openai-codex",
        accessToken: "access-token",
        refresh_token: "refresh-token",
        updatedAt: 1,
      },
      headers: {},
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      const requestHeaders = new Headers(init?.headers);
      const authorization = requestHeaders.get("authorization") ?? undefined;
      const body = JSON.parse(String(init?.body));

      return Effect.runPromise(
        handleRequest(
          {
            authorization,
          },
          body,
        ),
      );
    }) as typeof globalThis.fetch;

    try {
      const result = await generate(request, {
        endpoint: "https://example.com/v1/chat/completions",
        headers: {
          authorization: "Bearer test-token",
        },
      });

      expect(result.stream).toBe(true);
      const chunks = await readTextStream(result.textStream);
      const final = await result.final();

      expect(chunks).toEqual(["Hello from e2e"]);
      expect(final.text).toBe("Hello from e2e");
      expect(final.providerMetadata?.responseId).toBe("resp_e2e_1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("returns final JSON through the machine layer when stream is false", async () => {
    postImpl = async (url) => {
      if (url === "https://cautious-platypus-49.convex.site/verify-api-key") {
        return {
          status: 200,
          data: { valid: true, userId: "user-1" },
          headers: {},
        };
      }

      if (url === "https://chatgpt.com/backend-api/codex/responses") {
        return {
          status: 200,
          data: codexSseResponse({
            responseId: "resp_e2e_2",
            messageId: "msg_e2e_2",
            model: "gpt-5.4",
            delta: "Batch e2e response",
          }),
          headers: {
            "content-type": "text/event-stream",
          },
        };
      }

      throw new Error(`unexpected post url: ${url}`);
    };

    getImpl = async () => ({
      status: 200,
      data: {
        _id: "cred_1",
        _creationTime: 1,
        userId: "user-1",
        orgId: "org_1",
        provider: "openai-codex",
        accessToken: "access-token",
        refresh_token: "refresh-token",
        updatedAt: 1,
      },
      headers: {},
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      const requestHeaders = new Headers(init?.headers);
      const authorization = requestHeaders.get("authorization") ?? undefined;
      const body = JSON.parse(String(init?.body));

      return Effect.runPromise(
        handleRequest(
          {
            authorization,
          },
          body,
        ),
      );
    }) as typeof globalThis.fetch;

    try {
      const result = await generate(
        {
          ...request,
          stream: false,
        },
        {
          endpoint: "https://example.com/v1/chat/completions",
          headers: {
            authorization: "Bearer test-token",
          },
        },
      );

      expect(result.stream).toBe(false);
      if (!result.stream) {
        expect(result.response.text).toBe("Batch e2e response");
        expect(result.response.providerMetadata?.responseId).toBe("resp_e2e_2");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
