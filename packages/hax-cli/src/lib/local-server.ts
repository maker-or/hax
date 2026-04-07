import {
	type IncomingMessage,
	type Server,
	type ServerResponse,
	createServer,
} from "node:http";
import { handleChatGPTCallback } from "./chatgpt-oauth.js";
import { getCallbackPort } from "./env.js";

type ChatGPTCallbackResult = Awaited<ReturnType<typeof handleChatGPTCallback>>;
type HaxAuthCallbackResult = {
	detail: string;
	ok: boolean;
	payload?: unknown;
};

/** One server on IPv4 loopback and optionally one on IPv6 loopback (same port) so `http://localhost` redirects work whether the browser uses 127.0.0.1 or ::1. */
let servers: Server[] = [];
let lastChatGPTResult: ChatGPTCallbackResult | null = null;
let haxAuthCallbackHandler:
	| ((query: Record<string, string>) => Promise<HaxAuthCallbackResult>)
	| null = null;

const sendJson = (
	response: ServerResponse,
	statusCode: number,
	body: unknown,
) => {
	response.writeHead(statusCode, {
		"content-type": "application/json; charset=utf-8",
	});
	response.end(JSON.stringify(body, null, 2));
};

const sendHtml = (
	response: ServerResponse,
	statusCode: number,
	title: string,
	detail: string,
	payload: unknown,
) => {
	response.writeHead(statusCode, {
		"content-type": "text/html; charset=utf-8",
	});
	response.end(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 32px; background: #f6efe7; color: #2e1f11; }
          main { max-width: 640px; margin: 48px auto; padding: 24px; border-radius: 20px; background: white; box-shadow: 0 16px 40px rgba(46, 31, 17, 0.12); }
          h1 { margin-top: 0; }
          pre { white-space: pre-wrap; word-break: break-word; background: #f8f3ee; padding: 16px; border-radius: 12px; }
        </style>
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          <p>${detail}</p>
          <pre>${JSON.stringify(payload, null, 2)}</pre>
        </main>
      </body>
    </html>
  `);
};

const getQuery = (request: IncomingMessage, port: number) => {
	const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
	return {
		pathname: url.pathname,
		query: Object.fromEntries(url.searchParams.entries()),
	};
};

const requestListener =
	(port: number) =>
	async (request: IncomingMessage, response: ServerResponse) => {
		const { pathname, query } = getQuery(request, port);

		if (pathname === "/") {
			sendJson(response, 200, {
				ok: true,
				message: "Local auth server is running.",
			});
			return;
		}

		if (pathname === "/auth/debug") {
			sendJson(response, 200, { ok: true, lastChatGPTResult });
			return;
		}

		if (pathname === "/auth/callback") {
			const result = await handleChatGPTCallback(query);
			lastChatGPTResult = result;

			if (result.ok) {
				sendHtml(
					response,
					200,
					"ChatGPT auth completed",
					"You can go back to the terminal now.",
					result,
				);
				return;
			}

			sendHtml(
				response,
				400,
				"ChatGPT auth failed",
				result.error ?? "Unknown authentication error.",
				result,
			);
			return;
		}

		if (pathname === "/hax-auth/callback") {
			if (!haxAuthCallbackHandler) {
				sendHtml(
					response,
					503,
					"Hax CLI auth unavailable",
					"The CLI is not ready to receive authentication callbacks.",
					query,
				);
				return;
			}

			const result = await haxAuthCallbackHandler(query);
			sendHtml(
				response,
				result.ok ? 200 : 400,
				result.ok ? "Hax CLI auth completed" : "Hax CLI auth failed",
				result.detail,
				result.payload ?? query,
			);
			return;
		}

		sendJson(response, 404, { ok: false, error: "Not found" });
	};

/**
 * Registers the handler invoked for `/hax-auth/callback` query params.
 */
export const setHaxAuthCallbackHandler = (
	handler:
		| ((query: Record<string, string>) => Promise<HaxAuthCallbackResult>)
		| null,
) => {
	haxAuthCallbackHandler = handler;
};

const listenOne = (
	port: number,
	host: string,
	onRequest: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<Server> =>
	new Promise((resolve, reject) => {
		const s = createServer(onRequest);
		s.once("error", reject);
		s.listen({ port, host }, () => resolve(s));
	});

async function closeAllServers(): Promise<void> {
	await Promise.all(
		servers.map(
			(s) =>
				new Promise<void>((resolve, reject) => {
					s.close((error) => {
						if (error) {
							reject(error);
							return;
						}
						resolve();
					});
				}),
		),
	);
	servers = [];
}

function errnoCode(error: unknown): string | undefined {
	return error &&
		typeof error === "object" &&
		"code" in error &&
		typeof (error as { code?: unknown }).code === "string"
		? (error as { code: string }).code
		: undefined;
}

/**
 * Starts the local OAuth callback server on loopback and the configured port.
 *
 * Binds both `127.0.0.1` and `::1` when IPv6 loopback is available. OpenAI redirects to
 * `http://localhost:PORT/...`; browsers often resolve `localhost` to IPv6 first, while a
 * server listening only on IPv4 would never receive that callback (endless loading / timeout).
 */
export const startAuthServer = async () => {
	const port = getCallbackPort();
	if (servers.length > 0 && servers.every((s) => s.listening)) {
		return servers[0] as Server;
	}

	const onRequest = (request: IncomingMessage, response: ServerResponse) => {
		void requestListener(port)(request, response).catch((error) => {
			sendJson(response, 500, {
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			});
		});
	};

	servers = [];

	try {
		servers.push(await listenOne(port, "127.0.0.1", onRequest));
	} catch (error) {
		await closeAllServers();
		throw error;
	}

	try {
		servers.push(await listenOne(port, "::1", onRequest));
	} catch (error) {
		const code = errnoCode(error);
		if (code === "EADDRNOTAVAIL" || code === "EAFNOSUPPORT") {
			// IPv6 disabled or unavailable; IPv4-only is enough for some environments.
		} else {
			await closeAllServers();
			throw error;
		}
	}

	return servers[0] as Server;
};

/**
 * Stops the local OAuth callback server(s).
 */
export const stopAuthServer = async () => {
	if (servers.length === 0) {
		return;
	}

	await closeAllServers();
};
