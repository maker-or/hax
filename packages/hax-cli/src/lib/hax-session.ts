import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import keytar from "keytar";
import { getCallbackPort, getWebBaseUrl } from "./env.js";
import { setHaxAuthCallbackHandler, startAuthServer } from "./local-server.js";
import { openBrowser } from "./open-browser.js";
import { getHaxAuthJsonPath } from "./paths.js";

const haxCallbackPath = "/hax-auth/callback";
const haxAuthTimeoutMs = 5 * 60 * 1000;

/** Same service name as the desktop app so keychain entries can align. */
const haxAuthKeytarService = "dev.opencodetools.hax.desktop";
const haxAuthKeytarAccount = "hax-auth";

export type HaxAuthRecord = {
	accessToken?: string;
	accessTokenExpiresAt?: number;
	desktopSecret: string;
	desktopSessionId: string;
	receivedAt: number;
	state: string;
	user: Record<string, unknown>;
};

type HaxAuthMetadata = {
	accessToken?: string;
	accessTokenExpiresAt?: number;
	receivedAt: number;
	state: string;
	user: Record<string, unknown>;
};

type HaxAuthSecrets = {
	desktopSecret: string;
	desktopSessionId: string;
};

type PendingHaxAuth = {
	reject: (reason?: unknown) => void;
	resolve: (value: { auth: HaxAuthRecord; callbackUrl: string }) => void;
	state: string;
	timeoutId: ReturnType<typeof setTimeout>;
};

let pendingHaxAuth: PendingHaxAuth | null = null;

function getHaxDesktopCallbackUrl() {
	return new URL(haxCallbackPath, `http://127.0.0.1:${getCallbackPort()}`);
}

function getHaxAuthFilePath() {
	return getHaxAuthJsonPath();
}

async function readHaxAuthMetadata() {
	try {
		return JSON.parse(
			await readFile(getHaxAuthFilePath(), "utf8"),
		) as Partial<HaxAuthRecord>;
	} catch {
		return null;
	}
}

async function readHaxAuthSecrets() {
	const raw = await keytar.getPassword(
		haxAuthKeytarService,
		haxAuthKeytarAccount,
	);
	if (!raw) {
		return null;
	}

	const parsed = JSON.parse(raw) as Partial<HaxAuthSecrets>;
	if (!parsed.desktopSecret || !parsed.desktopSessionId) {
		return null;
	}

	return {
		desktopSecret: parsed.desktopSecret,
		desktopSessionId: parsed.desktopSessionId,
	} satisfies HaxAuthSecrets;
}

async function writeHaxAuthSecrets(secrets: HaxAuthSecrets) {
	await keytar.setPassword(
		haxAuthKeytarService,
		haxAuthKeytarAccount,
		JSON.stringify(secrets),
	);
}

async function writeHaxAuthMetadata(metadata: HaxAuthMetadata) {
	const filePath = getHaxAuthFilePath();
	await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
	await writeFile(filePath, JSON.stringify(metadata, null, 2), {
		encoding: "utf8",
		mode: 0o600,
	});
}

/**
 * Reads merged Hax session (metadata file + keytar secrets).
 */
export async function readHaxAuth(): Promise<HaxAuthRecord | null> {
	try {
		const metadata = (await readHaxAuthMetadata()) ?? {};
		const secrets = await readHaxAuthSecrets();

		if (!secrets && metadata.desktopSecret && metadata.desktopSessionId) {
			const legacySecrets = {
				desktopSecret: metadata.desktopSecret,
				desktopSessionId: metadata.desktopSessionId,
			};
			await writeHaxAuthSecrets(legacySecrets);
			await writeHaxAuthMetadata({
				accessToken: metadata.accessToken,
				accessTokenExpiresAt: metadata.accessTokenExpiresAt,
				receivedAt: metadata.receivedAt ?? Date.now(),
				state: metadata.state ?? "",
				user: metadata.user ?? {},
			});
			return {
				accessToken: metadata.accessToken,
				accessTokenExpiresAt: metadata.accessTokenExpiresAt,
				receivedAt: metadata.receivedAt ?? Date.now(),
				state: metadata.state ?? "",
				user: metadata.user ?? {},
				...legacySecrets,
			};
		}

		if (!secrets) {
			return null;
		}

		return {
			accessToken: metadata.accessToken,
			accessTokenExpiresAt: metadata.accessTokenExpiresAt,
			receivedAt:
				typeof metadata.receivedAt === "number"
					? metadata.receivedAt
					: Date.now(),
			state: typeof metadata.state === "string" ? metadata.state : "",
			user:
				metadata.user && typeof metadata.user === "object" ? metadata.user : {},
			...secrets,
		} satisfies HaxAuthRecord;
	} catch {
		const secrets = await readHaxAuthSecrets();
		if (!secrets) {
			return null;
		}

		return {
			accessToken: undefined,
			accessTokenExpiresAt: undefined,
			receivedAt: Date.now(),
			state: "",
			user: {},
			...secrets,
		} satisfies HaxAuthRecord;
	}
}

async function writeHaxAuth(record: HaxAuthRecord) {
	await Promise.all([
		writeHaxAuthSecrets({
			desktopSecret: record.desktopSecret,
			desktopSessionId: record.desktopSessionId,
		}),
		writeHaxAuthMetadata({
			accessToken: record.accessToken,
			accessTokenExpiresAt: record.accessTokenExpiresAt,
			receivedAt: record.receivedAt,
			state: record.state,
			user: record.user,
		}),
	]);
}

/**
 * Clears local Hax session (file + keytar).
 */
export async function clearHaxAuth() {
	try {
		await Promise.all([
			rm(getHaxAuthFilePath(), { force: true }),
			keytar.deletePassword(haxAuthKeytarService, haxAuthKeytarAccount),
		]);
	} catch (error) {
		throw new Error(
			`Failed to clear the local Hax session: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

function sanitizeHaxAuthRecord(record: HaxAuthRecord | null) {
	if (!record) {
		return null;
	}

	return {
		accessTokenExpiresAt: record.accessTokenExpiresAt,
		receivedAt: record.receivedAt,
		state: record.state,
		user: record.user,
	};
}

export async function getHaxAuthSnapshot() {
	return {
		filePath: getHaxAuthFilePath(),
		storedAuth: sanitizeHaxAuthRecord(await readHaxAuth()),
	};
}

function decodeJwtExpiry(token: string) {
	const payload = token.split(".")[1];
	if (!payload) {
		return null;
	}

	try {
		const claims = JSON.parse(
			Buffer.from(payload, "base64url").toString("utf8"),
		) as {
			exp?: number;
		};
		return claims.exp ? claims.exp * 1000 : null;
	} catch {
		return null;
	}
}

function hasUsableAccessToken(record: HaxAuthRecord) {
	if (!record.accessToken) {
		return false;
	}

	if (!record.accessTokenExpiresAt) {
		return true;
	}

	return Date.now() + 5 * 60 * 1000 < record.accessTokenExpiresAt;
}

/**
 * Refreshes the Hax access token using the stored desktop session credentials.
 */
export async function refreshDesktopAccessToken(record: HaxAuthRecord) {
	const refreshUrl = new URL("/desktop-auth/token", getWebBaseUrl());
	const response = await fetch(refreshUrl, {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			desktopSessionId: record.desktopSessionId,
			desktopSecret: record.desktopSecret,
		}),
	});

	const result = (await response.json().catch(() => null)) as {
		accessToken?: string;
		detail?: string;
		error?: string;
		expiresAt?: number | null;
	} | null;

	if (!response.ok || !result?.accessToken) {
		throw new Error(
			result?.detail ??
				result?.error ??
				"Failed to refresh the Hax access token.",
		);
	}

	const accessTokenExpiresAt =
		result.expiresAt ?? decodeJwtExpiry(result.accessToken) ?? undefined;
	const nextRecord: HaxAuthRecord = {
		...record,
		accessToken: result.accessToken,
		accessTokenExpiresAt,
		receivedAt: Date.now(),
	};

	await writeHaxAuth(nextRecord);
	return nextRecord;
}

export async function getValidAccessToken(
	forceRefresh = false,
): Promise<string> {
	const [metadata, secrets] = await Promise.all([
		readHaxAuthMetadata(),
		readHaxAuthSecrets(),
	]);

	if (!secrets?.desktopSessionId || !secrets.desktopSecret) {
		throw new Error("Sign in with Hax before connecting ChatGPT.");
	}

	const record: HaxAuthRecord = {
		accessToken: metadata?.accessToken,
		accessTokenExpiresAt: metadata?.accessTokenExpiresAt,
		receivedAt:
			typeof metadata?.receivedAt === "number"
				? metadata.receivedAt
				: Date.now(),
		state: typeof metadata?.state === "string" ? metadata.state : "",
		user:
			metadata?.user && typeof metadata.user === "object" ? metadata.user : {},
		...secrets,
	};

	if (!forceRefresh && hasUsableAccessToken(record)) {
		if (!record.accessToken) {
			throw new Error("Hax auth is missing an access token.");
		}

		return record.accessToken;
	}

	const refreshedRecord = await refreshDesktopAccessToken(record);
	if (!refreshedRecord.accessToken) {
		throw new Error("Hax auth refresh did not return an access token.");
	}

	return refreshedRecord.accessToken;
}

export function isExpiredAuthError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("InvalidAuthHeader") ||
		message.includes("Token expired") ||
		message.includes("Unauthenticated")
	);
}

export function isEndedDesktopSessionError(error: unknown) {
	const message = (
		error instanceof Error ? error.message : String(error)
	).toLowerCase();
	return (
		message.includes("session has already ended") ||
		message.includes("desktop session ended") ||
		message.includes("sign in with hax again")
	);
}

function generateAuthState() {
	return crypto.randomUUID();
}

function settlePendingHaxAuth() {
	if (!pendingHaxAuth) {
		return null;
	}

	const current = pendingHaxAuth;
	clearTimeout(current.timeoutId);
	pendingHaxAuth = null;
	return current;
}

async function exchangeDesktopAuthCode(code: string, state: string) {
	const exchangeUrl = new URL("/desktop-auth/exchange", getWebBaseUrl());
	const response = await fetch(exchangeUrl, {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ code, state }),
	});

	const result = (await response.json().catch(() => null)) as {
		accessToken?: string;
		desktopSecret?: string;
		desktopSessionId?: string;
		error?: string;
		tokenExpiresAt?: number;
		user?: Record<string, unknown>;
	} | null;

	if (
		!response.ok ||
		!result?.desktopSecret ||
		!result?.desktopSessionId ||
		!result?.user
	) {
		throw new Error(result?.error ?? "Hax auth exchange failed.");
	}

	const record: HaxAuthRecord = {
		accessToken: result.accessToken,
		accessTokenExpiresAt:
			result.tokenExpiresAt ??
			(result.accessToken
				? (decodeJwtExpiry(result.accessToken) ?? undefined)
				: undefined),
		desktopSecret: result.desktopSecret,
		desktopSessionId: result.desktopSessionId,
		receivedAt: Date.now(),
		state,
		user: result.user,
	};

	await writeHaxAuth(record);
	return record;
}

async function completeHaxAuth(code: string, state: string) {
	if (!pendingHaxAuth) {
		throw new Error("No Hax auth request is waiting for a callback.");
	}

	if (state !== pendingHaxAuth.state) {
		throw new Error("Hax auth state mismatch.");
	}

	const auth = await exchangeDesktopAuthCode(code, state);
	settlePendingHaxAuth()?.resolve({
		auth,
		callbackUrl: getHaxDesktopCallbackUrl().toString(),
	});
}

/**
 * Starts the browser Hax login flow; requires `startAuthServer` and `setHaxAuthCallbackHandler` to be wired (see `runHaxLoginFlow`).
 */
export async function startHaxBrowserLogin(): Promise<{
	callbackUrl: string;
	ok: boolean;
	startUrl: string;
	filePath: string;
	storedAuth: ReturnType<typeof sanitizeHaxAuthRecord>;
}> {
	if (pendingHaxAuth) {
		throw new Error("Hax auth is already in progress.");
	}

	const state = generateAuthState();
	const startUrl = new URL("/desktop-auth/start", getWebBaseUrl());
	startUrl.searchParams.set(
		"callback_url",
		getHaxDesktopCallbackUrl().toString(),
	);
	startUrl.searchParams.set("state", state);

	const resultPromise = new Promise<{
		auth: HaxAuthRecord;
		callbackUrl: string;
	}>((resolve, reject) => {
		const timeoutId = setTimeout(() => {
			pendingHaxAuth = null;
			reject(new Error("Hax auth timed out."));
		}, haxAuthTimeoutMs);

		pendingHaxAuth = {
			resolve,
			reject,
			state,
			timeoutId,
		};
	});

	await openBrowser(startUrl.toString());

	return resultPromise.then(async (result) => ({
		callbackUrl: result.callbackUrl,
		ok: true,
		startUrl: startUrl.toString(),
		...(await getHaxAuthSnapshot()),
	}));
}

/**
 * Wires the Hax callback handler and runs browser login until completion or error.
 */
export async function runHaxLoginFlow() {
	await startAuthServer();

	setHaxAuthCallbackHandler(async (query) => {
		try {
			const code = query.code;
			const state = query.state;

			if (!code || !state) {
				throw new Error("Hax auth callback is missing code or state.");
			}

			await completeHaxAuth(code, state);

			return {
				detail: "You can go back to the terminal now.",
				ok: true,
				payload: query,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			settlePendingHaxAuth()?.reject(new Error(message));

			return {
				detail: message,
				ok: false,
				payload: query,
			};
		}
	});

	try {
		return await startHaxBrowserLogin();
	} finally {
		setHaxAuthCallbackHandler(null);
	}
}

/**
 * Returns a valid Convex auth token, refreshing when needed.
 */
export async function getValidConvexAuthToken(
	forceRefresh = false,
): Promise<string> {
	return getValidAccessToken(forceRefresh);
}
