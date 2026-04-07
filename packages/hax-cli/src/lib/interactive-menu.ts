import * as readline from "node:readline";
import inquirer from "inquirer";

/** What the user chose in the “Connect a subscription” prompt (only enabled options are returned from the inquirer UI). */
export type ProviderChoice = "chatgpt" | "exit";

/**
 * Shows a list prompt to pick how to connect a subscription (ChatGPT or exit). Falls back to a numbered menu when stdin/stdout are not TTY.
 */
export async function showProviderMenu(): Promise<ProviderChoice> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return showProviderMenuReadlineFallback();
	}

	const { provider } = await inquirer.prompt<{ provider: ProviderChoice }>([
		{
			type: "select",
			name: "provider",
			message: "Connect a subscription",
			choices: [
				{ name: "ChatGPT (OpenAI Codex)", value: "chatgpt" },
				{
					name: "Copilot (coming soon)",
					value: "copilot",
					disabled: "Coming soon",
				},
				{
					name: "Gemini (coming soon)",
					value: "gemini",
					disabled: "Coming soon",
				},
				new inquirer.Separator(),
				{ name: "Exit", value: "exit" },
			],
		},
	]);

	return provider;
}

/**
 * Numbered menu when the terminal is not interactive (pipes, CI); mirrors the inquirer options.
 */
async function showProviderMenuReadlineFallback(): Promise<ProviderChoice> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const question = (prompt: string) =>
		new Promise<string>((resolve) => rl.question(prompt, resolve));

	try {
		process.stdout.write("\nConnect a subscription:\n");
		process.stdout.write("  1) ChatGPT (OpenAI Codex)\n");
		process.stdout.write("  2) Copilot (coming soon — unavailable)\n");
		process.stdout.write("  3) Gemini (coming soon — unavailable)\n");
		process.stdout.write("  0) Exit\n\n");

		const answer = (await question("Choose an option [0-3]: ")).trim();

		switch (answer) {
			case "1":
				return "chatgpt";
			case "2":
			case "3":
				process.stderr.write("That provider is not available yet.\n");
				return "exit";
			case "0":
				return "exit";
			default:
				process.stderr.write("Invalid choice.\n");
				return "exit";
		}
	} finally {
		rl.close();
	}
}
