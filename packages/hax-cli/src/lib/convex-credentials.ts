import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { getConvexUrl } from "./env.js";
import {
	getValidAccessToken,
	isEndedDesktopSessionError,
	isExpiredAuthError,
	readHaxAuth,
	runHaxLoginFlow,
} from "./hax-session.js";
import { startAuthServer } from "./local-server.js";

type OpenAiIdTokenClaims = {
	chatgpt_account_id: string;
	chatgpt_plan_type: string;
	chatgpt_subscription_active_start: string;
	chatgpt_subscription_active_until: string;
	chatgpt_subscription_last_checked: string;
	chatgpt_user_id: string;
};

async function loadConvexApi(): Promise<{
	aicrendital: { createCredential: unknown };
}> {
	const url = new URL("../../../../convex/_generated/api.js", import.meta.url);
	const mod = (await import(url.href)) as {
		api: { aicrendital: { createCredential: unknown } };
	};
	return mod.api;
}

/**
 * Persists ChatGPT (OpenAI Codex) tokens in Convex using the current Hax user session.
 */
export async function storeChatGPTCredentialInConvex(input: {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	token_id: string | undefined;
	account: Record<string, unknown> | null;
	provider_subscriptionType: string;
	provider_user_id: string;
	provider_account_id: string;
	provider_sub_active_start: string;
	provider_sub_active_until: string;
}) {
	const api = await loadConvexApi();
	const convex = new ConvexHttpClient(getConvexUrl());
	const runMutation = async (authToken: string) => {
		convex.setAuth(authToken);
		const args = {
			provider: "openai-codex" as const,
			provider_subscriptionType: input.provider_subscriptionType,
			provider_user_id: input.provider_user_id,
			provider_account_id: input.provider_account_id,
			provider_sub_active_start: input.provider_sub_active_start,
			provider_sub_active_until: input.provider_sub_active_until,
			accessToken: input.accessToken,
			token_id: input.token_id,
			refresh_token: input.refreshToken,
			expiresAt: input.expiresAt,
		};
		const ref = api.aicrendital.createCredential as FunctionReference<
			"mutation",
			"public",
			typeof args,
			unknown
		>;
		return convex.mutation(ref, args);
	};

	const cachedAuth = await readHaxAuth();
	if (cachedAuth?.accessToken) {
		try {
			return await runMutation(cachedAuth.accessToken);
		} catch (error) {
			if (!isExpiredAuthError(error)) {
				throw error;
			}
		}
	}

	try {
		return await runMutation(await getValidAccessToken(true));
	} catch (error) {
		if (!isEndedDesktopSessionError(error)) {
			throw error;
		}

		await startAuthServer();
		await runHaxLoginFlow();

		const refreshedAuth = await readHaxAuth();
		if (!refreshedAuth?.accessToken) {
			throw new Error("Hax auth completed without an access token.");
		}

		return await runMutation(refreshedAuth.accessToken);
	}
}

/**
 * Maps ChatGPT OAuth credentials into Convex `createCredential` args using OpenAI id_token claims.
 */
export function mapChatGPTCredentialsToConvexArgs(credentials: {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	account: Record<string, unknown> | null;
	raw: { id_token?: string };
}) {
	const pro = credentials.account?.["https://api.openai.com/auth"] as
		| OpenAiIdTokenClaims
		| undefined;
	if (!pro) {
		throw new Error("Missing OpenAI profile claims in ChatGPT credentials.");
	}
	return {
		accessToken: credentials.accessToken,
		refreshToken: credentials.refreshToken,
		expiresAt: credentials.expiresAt,
		account: credentials.account,
		token_id: credentials.raw.id_token,
		provider_subscriptionType: pro.chatgpt_plan_type,
		provider_user_id: pro.chatgpt_user_id,
		provider_account_id: pro.chatgpt_account_id,
		provider_sub_active_start: pro.chatgpt_subscription_active_start,
		provider_sub_active_until: pro.chatgpt_subscription_active_until,
	};
}
