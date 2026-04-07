import ora, { type Options } from "ora";

/**
 * Creates a terminal spinner for long-running CLI steps. Animation is off when stdout is not a TTY (for example in CI or piped output).
 */
export function createSpinner(text: string, options?: Options) {
	return ora({
		text,
		isEnabled: process.stdout.isTTY,
		...options,
	});
}
