/// <reference types="vite/client" />

/**
 * Vite `import.meta.env` keys for the local playground.
 * Values are supplied via `apps/playground/src/.env`.
 */
interface ImportMetaEnv {
	readonly VITE_MACHINE_BASE_URL: string | undefined;
	readonly VITE_MACHINE_ACCESS_TOKEN: string | undefined;
	readonly VITE_MACHINE_REFRESH_TOKEN: string | undefined;
	readonly VITE_MACHINE_CLIENT_ID: string | undefined;
	readonly VITE_MACHINE_CLIENT_SECRET: string | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
