import { Command, Flags } from "@oclif/core";
import { createSpinner } from "../lib/cli-spinner.js";
import { loadRepoEnv } from "../lib/env.js";
import { runHaxLoginFlow } from "../lib/hax-session.js";

/**
 * Opens the browser to sign in to Hax and stores the session locally.
 */
export default class Login extends Command {
	static override id = "login";

	static override description = "Sign in to Hax in the browser";

	static override flags = {
		"no-update-notifier": Flags.boolean({
			description: "Skip checking for newer CLI versions",
			default: false,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Login);
		if (flags["no-update-notifier"]) {
			process.env.NO_UPDATE_NOTIFIER = "1";
		}

		loadRepoEnv();

		if (process.stdout.isTTY) {
			const spinner = createSpinner("Opening browser for Hax sign-in…").start();
			await runHaxLoginFlow();
			spinner.succeed("Session saved.");
		} else {
			this.log("Opening browser for Hax sign-in…");
			await runHaxLoginFlow();
			this.log("Done. Session saved.");
		}
	}
}
