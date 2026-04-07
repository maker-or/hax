import { spawn } from "node:child_process";

/**
 * Opens a URL in the system default browser (same behavior as desktop ChatGPT flow).
 */
export async function openBrowser(url: string): Promise<void> {
	const platform = process.platform;
	if (platform === "darwin") {
		await new Promise<void>((resolve, reject) => {
			const proc = spawn("open", [url], { stdio: "ignore" });
			proc.once("error", reject);
			proc.once("close", () => resolve());
		});
		return;
	}
	if (platform === "win32") {
		await new Promise<void>((resolve, reject) => {
			const proc = spawn("cmd", ["/c", "start", "", url], {
				stdio: "ignore",
				windowsHide: true,
			});
			proc.once("error", reject);
			proc.once("close", () => resolve());
		});
		return;
	}
	await new Promise<void>((resolve, reject) => {
		const proc = spawn("xdg-open", [url], { stdio: "ignore" });
		proc.once("error", reject);
		proc.once("close", () => resolve());
	});
}
