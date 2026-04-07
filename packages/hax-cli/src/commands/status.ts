import { Command, Flags } from "@oclif/core";
import { loadRepoEnv } from "../lib/env.js";
import { getHaxAuthSnapshot } from "../lib/hax-session.js";

/**
 * Prints a sanitized view of the stored Hax session (no secrets).
 */
export default class Status extends Command {
	static override id = "status";

	static override description = "Show local Hax session status";

	static override flags = {
		"no-update-notifier": Flags.boolean({
			description: "Skip checking for newer CLI versions",
			default: false,
		}),
		json: Flags.boolean({
			description: "Print JSON",
			default: false,
		}),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Status);
		if (flags["no-update-notifier"]) {
			process.env.NO_UPDATE_NOTIFIER = "1";
		}

		loadRepoEnv();
		const snap = await getHaxAuthSnapshot();

		if (flags.json) {
			this.log(
				JSON.stringify(
					{ filePath: snap.filePath, storedAuth: snap.storedAuth },
					null,
					2,
				),
			);
			return;
		}

		this.log(`Auth file: ${snap.filePath}`);
		if (snap.storedAuth?.user && typeof snap.storedAuth.user === "object") {
			this.log(`User: ${JSON.stringify(snap.storedAuth.user)}`);
		} else {
			this.log("No user metadata stored.");
		}
	}
}
