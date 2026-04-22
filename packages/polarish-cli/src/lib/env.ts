import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvFile } from "dotenv";

/**
 * Loads `.env` and `.env.local` from monorepo root.
 * This lets CLI commands read shared env vars in local development.
 */
export function loadRepoEnv(): void {
	let dir = path.dirname(fileURLToPath(import.meta.url));
	for (let i = 0; i < 12; i++) {
		const envPath = path.join(dir, ".env");
		const localPath = path.join(dir, ".env.local");
		if (existsSync(envPath)) {
			loadEnvFile({ path: envPath });
		}
		if (existsSync(localPath)) {
			loadEnvFile({ path: localPath, override: true });
		}
		if (existsSync(path.join(dir, "convex"))) {
			break;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			break;
		}
		dir = parent;
	}
}
