import { Command, Flags } from "@oclif/core";
import { runConnectChatGPTFlow } from "../../lib/connect-chatgpt-flow.js";
import { ensureHaxAuthenticated } from "../../lib/ensure-hax-auth.js";
import { loadRepoEnv } from "../../lib/env.js";

/**
 * Connects ChatGPT (OpenAI Codex) OAuth and saves credentials to Convex.
 */
export default class ConnectChatgpt extends Command {
	static override id = "chatgpt";

	static override description =
		"Connect your ChatGPT account and store credentials in Convex";

	static override flags = {
		"no-update-notifier": Flags.boolean({
			description: "Skip checking for newer CLI versions",
			default: false,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(ConnectChatgpt);
		if (flags["no-update-notifier"]) {
			process.env.NO_UPDATE_NOTIFIER = "1";
		}

		loadRepoEnv();
		await ensureHaxAuthenticated({ interactive: true });
		await runConnectChatGPTFlow();
	}
}
