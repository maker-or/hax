/// <reference types="vite/client" />

/**
 * Vite `import.meta.env` keys for the local playground.
 * Values are supplied via `apps/playground/src/.env`.
 */
interface ImportMetaEnv {
	/**
	 * Base URL for `@hax/ai` machine requests (`/api/v1/chat/completions`).
	 * In local dev, omit this to use the current origin so Vite can proxy `/api` to `apps/web` and avoid CORS.
	 * Do not set this to your `*.authkit.app` host in the browser — AuthKit does not allow that origin.
	 */
	readonly VITE_MACHINE_BASE_URL: string | undefined;
	readonly VITE_MACHINE_ACCESS_TOKEN: string | undefined;
	readonly VITE_MACHINE_REFRESH_TOKEN: string | undefined;
	readonly VITE_MACHINE_CLIENT_ID: string | undefined;
	readonly VITE_MACHINE_CLIENT_SECRET: string | undefined;
	/**
	 * Legacy fallback for machine base URL. Do not set this to your `*.authkit.app` URL — use same-origin + Vite proxy instead.
	 */
	readonly VITE_WORKOS_TOKEN_ENDPOINT: string | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
