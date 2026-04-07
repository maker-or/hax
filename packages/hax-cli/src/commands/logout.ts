import { Command, Flags } from "@oclif/core";
import { loadRepoEnv } from "../lib/env.js";
import { clearHaxAuth } from "../lib/hax-session.js";

/**
 * Clears the local Hax session (keychain + config file).
 */
export default class Logout extends Command {
	static override id = "logout";

	static override description = "Sign out and remove the local Hax session";

	static override flags = {
		"no-update-notifier": Flags.boolean({
			description: "Skip checking for newer CLI versions",
			default: false,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Logout);
		if (flags["no-update-notifier"]) {
			process.env.NO_UPDATE_NOTIFIER = "1";
		}

		loadRepoEnv();
		await clearHaxAuth();
		this.log("Signed out.");
	}
}
