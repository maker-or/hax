import { spawn } from "node:child_process";
import { getCallbackPort } from "./env.js";

const ChatGPTAuthEndpoint = "https://auth.openai.com/oauth/authorize";
const ChatGPTTokenEndpoint = "https://auth.openai.com/oauth/token";
const ChatGPTClientID = "app_EMoamEEZ73f0CkXaXp7hrann";
const ChatGPTScopes = "openid profile email offline_access";

export type ChatGPTTokenResponse = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string;
	token_type: string;
	id_token?: string;
};

export type ChatGPTCredentials = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scope: string;
	tokenType: string;
	account: Record<string, unknown> | null;
	raw: ChatGPTTokenResponse;
};

type PkceCodes = {
	codeVerifier: string;
	challenge: string;
};

type PendingAuthSession = {
	codeVerifier: string;
	state: string;
	resolve: (value: ChatGPTAuthResult) => void;
	reject: (reason?: unknown) => void;
	/** Cleared as soon as the HTTP callback is received; does not cover token exchange. */
	browserWaitTimeoutId: ReturnType<typeof setTimeout>;
};

export type ChatGPTAuthResult = {
	ok: boolean;
	authUrl?: string;
	callback?: Record<string, string>;
	credentials?: ChatGPTCredentials;
	error?: string;
};

/** Max time to wait for the browser to hit `/auth/callback` after we open the authorize URL (does not include token exchange). */
const BrowserRedirectTimeoutMs = 15 * 60 * 1000;

/** Max time for the server-side `fetch` to OpenAI’s token endpoint after we already have an auth `code`. */
const TokenExchangeTimeoutMs = 120 * 1000;

let pendingAuthSession: PendingAuthSession | null = null;

/**
 * Returns the redirect URI string for ChatGPT OAuth (must match the local server route and token exchange).
 *
 * Uses `localhost` (same as OpenAI Codex); the callback server listens on both `127.0.0.1` and `::1` so the browser can complete the redirect.
 */
export function getChatGPTRedirectUri(): string {
	const port = getCallbackPort();
	return `http://localhost:${port}/auth/callback`;
}

const generateRandomString = (length: number): string => {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes)
		.map((b) => chars[b % chars.length] ?? "")
		.join("");
};

const base64UrlEncode = (buffer: ArrayBuffer): string => {
	const bytes = new Uint8Array(buffer);
	const binary = String.fromCharCode(...bytes);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
};

const generateState = (): string =>
	base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer);

const generatePKCE = async () => {
	const codeVerifier = generateRandomString(43);
	const hash = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(codeVerifier),
	);
	const challenge = base64UrlEncode(hash);
	return { codeVerifier, challenge };
};

const openBrowser = async (url: string): Promise<void> => {
	const platform = process.platform;
	if (platform === "darwin") {
		await new Promise<void>((resolve, reject) => {
			const proc = spawn("open", [url], { stdio: "ignore" });
			proc.once("error", reject);
			proc.once("close", () => resolve());
		});
		return;
	}
	if (platform === "win32") {
		await new Promise<void>((resolve, reject) => {
			const proc = spawn("cmd", ["/c", "start", "", url], {
				stdio: "ignore",
				windowsHide: true,
			});
			proc.once("error", reject);
			proc.once("close", () => resolve());
		});
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const proc = spawn("xdg-open", [url], { stdio: "ignore" });
		proc.once("error", reject);
		proc.once("close", () => resolve());
	});
};

const buildAuthorizeUrl = (pkce: PkceCodes, state: string): string => {
	const redirectUri = getChatGPTRedirectUri();
	const params = new URLSearchParams({
		response_type: "code",
		client_id: ChatGPTClientID,
		redirect_uri: redirectUri,
		scope: ChatGPTScopes,
		code_challenge: pkce.challenge,
		code_challenge_method: "S256",
		id_token_add_organizations: "true",
		codex_cli_simplified_flow: "true",
		state,
		originator: "opencode",
	});
	return `${ChatGPTAuthEndpoint}?${params.toString()}`;
};

const normalizeQueryValue = (value: string | string[] | undefined): string => {
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}
	return value ?? "";
};

const parseJwtPayload = (token?: string): Record<string, unknown> | null => {
	if (!token) {
		return null;
	}
	const parts = token.split(".");
	const middle = parts[1];
	if (parts.length < 2 || middle === undefined) {
		return null;
	}
	try {
		const payload = Buffer.from(middle, "base64url").toString("utf8");
		const parsed = JSON.parse(payload);
		return parsed && typeof parsed === "object"
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
};

const exchangeCodeForToken = async (
	code: string,
	codeVerifier: string,
): Promise<ChatGPTTokenResponse> => {
	const redirectUri = getChatGPTRedirectUri();
	const response = await fetch(ChatGPTTokenEndpoint, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			client_id: ChatGPTClientID,
			code,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier,
		}).toString(),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Token exchange failed (${response.status}): ${body}`);
	}

	return (await response.json()) as ChatGPTTokenResponse;
};

const buildCredentials = (
	tokenResponse: ChatGPTTokenResponse,
): ChatGPTCredentials => ({
	accessToken: tokenResponse.access_token,
	refreshToken: tokenResponse.refresh_token,
	expiresAt: Date.now() + tokenResponse.expires_in * 1000,
	scope: tokenResponse.scope,
	tokenType: tokenResponse.token_type,
	account: parseJwtPayload(tokenResponse.id_token),
	raw: tokenResponse,
});

const settlePendingAuthSession = () => {
	if (!pendingAuthSession) {
		return null;
	}
	const session = pendingAuthSession;
	clearTimeout(session.browserWaitTimeoutId);
	pendingAuthSession = null;
	return session;
};

/**
 * Starts ChatGPT OAuth in the browser and waits for the local `/auth/callback` handler to finish.
 */
export async function startChatGPTAuth(): Promise<ChatGPTAuthResult> {
	if (pendingAuthSession) {
		throw new Error("ChatGPT auth is already in progress.");
	}

	const pkce = await generatePKCE();
	const state = generateState();
	const authUrl = buildAuthorizeUrl(pkce, state);

	const resultPromise = new Promise<ChatGPTAuthResult>((resolve, reject) => {
		const browserWaitTimeoutId = setTimeout(() => {
			pendingAuthSession = null;
			reject(
				new Error(
					"ChatGPT authentication timed out waiting for the browser to return to this machine (no callback to the local server). Check that http://localhost redirects are not blocked, or try again.",
				),
			);
		}, BrowserRedirectTimeoutMs);

		pendingAuthSession = {
			codeVerifier: pkce.codeVerifier,
			state,
			resolve,
			reject,
			browserWaitTimeoutId,
		};
	});

	await openBrowser(authUrl);

	return resultPromise.then((result) => ({
		...result,
		authUrl,
	}));
}

/**
 * Handles the OAuth redirect query on `/auth/callback` (called from the local HTTP server).
 */
export async function handleChatGPTCallback(
	query: Record<string, string | string[] | undefined>,
): Promise<ChatGPTAuthResult> {
	const session = pendingAuthSession;
	const callback = {
		code: normalizeQueryValue(query.code),
		error: normalizeQueryValue(query.error),
		errorDescription: normalizeQueryValue(query.error_description),
		state: normalizeQueryValue(query.state),
	};

	if (!session) {
		return {
			ok: false,
			callback,
			error: "No ChatGPT auth session is waiting for a callback.",
		};
	}

	// Stop the “waiting for redirect” timer. Token exchange is timed separately so a slow OpenAI response does not look like a failed browser handoff.
	clearTimeout(session.browserWaitTimeoutId);

	try {
		if (callback.error) {
			throw new Error(callback.errorDescription || callback.error);
		}
		if (!callback.code) {
			throw new Error("Missing authorization code in callback.");
		}
		if (!callback.state || callback.state !== session.state) {
			throw new Error("State mismatch while completing ChatGPT auth.");
		}

		let exchangeTimer: ReturnType<typeof setTimeout> | undefined;
		const exchangePromise = exchangeCodeForToken(
			callback.code,
			session.codeVerifier,
		).finally(() => {
			if (exchangeTimer !== undefined) {
				clearTimeout(exchangeTimer);
			}
		});
		const timeoutPromise = new Promise<never>((_, reject) => {
			exchangeTimer = setTimeout(() => {
				reject(
					new Error(
						`Token exchange timed out after ${TokenExchangeTimeoutMs / 1000}s (OpenAI token endpoint). Sign-in may have succeeded in the browser; check your network or proxy and try again.`,
					),
				);
			}, TokenExchangeTimeoutMs);
		});

		const tokenResponse = await Promise.race([exchangePromise, timeoutPromise]);
		const credentials = buildCredentials(tokenResponse);

		const result = {
			ok: true,
			callback,
			credentials,
		} satisfies ChatGPTAuthResult;

		settlePendingAuthSession()?.resolve(result);
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const result = {
			ok: false,
			callback,
			error: message,
		} satisfies ChatGPTAuthResult;

		settlePendingAuthSession()?.reject(new Error(message));
		return result;
	}
}
