import type { Hook } from "@oclif/core";
import { isAutostartConfigured, setupAutostart } from "../lib/autostart.js";
import { ensureHarnessInstalled } from "../lib/harness-installer.js";

/**
 * This returns true when user ran help/version style commands.
 */
function isHelpOrVersionInvocation(argv: string[]): boolean {
	const firstArg = argv[0];
	return ["--help", "-h", "help", "--version", "-v", "version"].includes(
		firstArg,
	);
}

/**
 * This returns true when current command is `bridge run`.
 */
function isBridgeRunInvocation(argv: string[]): boolean {
	return argv[0] === "bridge" && argv[1] === "run";
}

/**
 * This returns true when stdin and stdout are both interactive terminals.
 */
function isInteractiveTerminal(): boolean {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Runs before any command.
 * Ensures autostart is configured, and only runs interactive provider setup in interactive shells.
 */
const hook: Hook<"init"> = async function init() {
	const argv = process.argv.slice(2);
	if (isHelpOrVersionInvocation(argv)) {
		return;
	}

	if (!(await isAutostartConfigured())) {
		await setupAutostart();
	}

	if (!isInteractiveTerminal() || isBridgeRunInvocation(argv)) {
		return;
	}

	try {
		await ensureHarnessInstalled();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`Skipped provider setup: ${message}`);
	}
};

export default hook;
