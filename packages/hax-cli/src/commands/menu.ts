import { Command, Flags } from "@oclif/core";
import { runConnectChatGPTFlow } from "../lib/connect-chatgpt-flow.js";
import { ensureHaxAuthenticated } from "../lib/ensure-hax-auth.js";
import { loadRepoEnv } from "../lib/env.js";
import { showProviderMenu } from "../lib/interactive-menu.js";

/**
 * Interactive entry: ensures Hax auth, then lists providers to connect (e.g. ChatGPT).
 */
export default class Menu extends Command {
	static override id = "menu";

	static override description =
		"Sign in to Hax (if needed) and choose a provider to connect";

	static override flags = {
		"no-update-notifier": Flags.boolean({
			description: "Skip checking for newer CLI versions",
			default: false,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Menu);
		if (flags["no-update-notifier"]) {
			process.env.NO_UPDATE_NOTIFIER = "1";
		}

		loadRepoEnv();
		await ensureHaxAuthenticated({ interactive: true });

		const choice = await showProviderMenu();

		if (choice === "exit") {
			this.exit(0);
			return;
		}

		if (choice === "chatgpt") {
			await runConnectChatGPTFlow();
		}
	}
}
