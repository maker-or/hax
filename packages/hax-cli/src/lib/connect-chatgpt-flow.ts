import { startChatGPTAuth } from "./chatgpt-oauth.js";
import { createSpinner } from "./cli-spinner.js";
import {
	mapChatGPTCredentialsToConvexArgs,
	storeChatGPTCredentialInConvex,
} from "./convex-credentials.js";
import { startAuthServer } from "./local-server.js";

/**
 * Runs ChatGPT OAuth and stores the credential in Convex (expects Hax auth to be valid).
 */
export async function runConnectChatGPTFlow(): Promise<void> {
	const spinner = createSpinner("Starting local server for OAuth…").start();

	await startAuthServer();
	spinner.text = "Complete ChatGPT sign-in in your browser…";

	const result = await startChatGPTAuth();

	if (!result.ok || !result.credentials) {
		spinner.fail("ChatGPT sign-in failed");
		throw new Error(
			result.error ?? "ChatGPT authentication did not return credentials.",
		);
	}

	spinner.text = "Saving credentials to Convex…";

	let storageError: string | undefined;
	try {
		await storeChatGPTCredentialInConvex(
			mapChatGPTCredentialsToConvexArgs(result.credentials),
		);
	} catch (error) {
		storageError = error instanceof Error ? error.message : String(error);
	}

	if (storageError) {
		spinner.fail("Could not save credential to Convex");
		throw new Error(
			`Failed to store ChatGPT credential in Convex: ${storageError}`,
		);
	}

	spinner.succeed("ChatGPT connected and saved to Convex.");
}
