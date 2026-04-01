import { Effect } from "effect";
import type { appRequestShape } from "../providers/openai-codex/types.ts";
import type {
	Client,
	CreateClientOptions,
	UnifiedGenerateResult,
} from "../types.ts";
import { generate } from "./generate.ts";
import { refreshAccessToken as refreshTokens } from "./refresh-access-token.ts";

const DEFAULT_BASE_URL = "https://your-default-polaris-url";
const MACHINE_ENDPOINT_PATH = "/api/v1/chat/completions";

function ensureTrailingSlash(value: string): string {
	return value.endsWith("/") ? value : `${value}/`;
}

function resolveEndpoint(baseUrl?: string): string {
	const resolvedBaseUrl = baseUrl?.trim() || DEFAULT_BASE_URL;
	return new URL(
		MACHINE_ENDPOINT_PATH,
		ensureTrailingSlash(resolvedBaseUrl),
	).toString();
}

export function create(options: CreateClientOptions): Client {
	let accessToken = options.accessToken.trim();

	if (!accessToken) {
		throw new Error("create() requires a non-empty `accessToken`.");
	}

	let refreshToken = options.refreshToken.trim();

	const endpoint = resolveEndpoint(options.baseUrl);

	const runGenerate = (
		request: appRequestShape,
	): Promise<UnifiedGenerateResult> =>
		generate(request, {
			endpoint,
			headers: {
				authorization: `Bearer ${accessToken}`,
			},
		});

	const isExpiredAccessTokenError = (error: unknown): boolean => {
		if (!(error instanceof Error)) {
			return false;
		}

		const message = error.message.toLowerCase();
		return (
			message.includes("status 401") ||
			message.includes("invalid_api_key") ||
			message.includes("access token") ||
			message.includes("expired")
		);
	};

	const refreshSession = async (): Promise<void> => {
		if (!refreshToken) {
			throw new Error(
				"Access token expired and no `refreshToken` is available.",
			);
		}

		const refreshed = await Effect.runPromise(
			refreshTokens({
				refreshToken,
				clientId: options.clientId,
				clientSecret: options.clientSecret,
			}),
		);

		accessToken = refreshed.accessToken;
		refreshToken = refreshed.refreshToken ?? refreshToken;
	};

	return {
		async generate(request: appRequestShape): Promise<UnifiedGenerateResult> {
			try {
				return await runGenerate(request);
			} catch (error) {
				if (!isExpiredAccessTokenError(error)) {
					throw error;
				}

				await refreshSession();

				if (!accessToken) {
					throw new Error(
						"Access token refresh did not produce a valid token.",
					);
				}

				return runGenerate(request);
			}
		},
	};
}
