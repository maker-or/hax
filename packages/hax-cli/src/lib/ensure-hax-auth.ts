import { createSpinner } from "./cli-spinner.js";
import { getValidAccessToken, runHaxLoginFlow } from "./hax-session.js";

/**
 * Ensures the user has a Hax session with a usable access token (refreshing when possible); runs browser login when needed.
 *
 * @param interactive When true, shows a spinner while opening the browser and verifying sign-in (stderr is used by the spinner when TTY).
 */
export async function ensureHaxAuthenticated(options: {
	interactive: boolean;
}): Promise<void> {
	try {
		await getValidAccessToken(false);
		return;
	} catch {
		// Missing session or refresh failed — continue to browser login
	}

	if (!options.interactive) {
		await runHaxLoginFlow();
		try {
			await getValidAccessToken(false);
		} catch {
			throw new Error(
				"Hax sign-in did not complete successfully. Run `hax login` and try again.",
			);
		}
		return;
	}

	const spinner = createSpinner("Opening browser for Hax sign-in…").start();

	try {
		await runHaxLoginFlow();
		spinner.text = "Verifying Hax session…";
		await getValidAccessToken(false);
		spinner.succeed("Signed in to Hax");
	} catch {
		spinner.fail("Hax sign-in did not complete");
		throw new Error(
			"Hax sign-in did not complete successfully. Run `hax login` and try again.",
		);
	}
}
