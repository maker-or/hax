/**
 * Detects errors from undici/Node fetch when Convex cannot be reached (timeout, DNS, refused).
 * Used to return 503 instead of a generic 500 from route handlers.
 */
export function isLikelyConvexConnectivityError(error: unknown): boolean {
	if (error === null || error === undefined) {
		return false;
	}

	const walk = (e: unknown): boolean => {
		if (!e || typeof e !== "object") {
			return false;
		}
		const o = e as { code?: string; cause?: unknown; message?: string };
		if (o.code === "UND_ERR_CONNECT_TIMEOUT") {
			return true;
		}
		if (o.code === "ENOTFOUND" || o.code === "ECONNREFUSED") {
			return true;
		}
		const msg = typeof o.message === "string" ? o.message : "";
		if (msg.includes("Connect Timeout") || msg.includes("ETIMEDOUT")) {
			return true;
		}
		if (o.cause) {
			return walk(o.cause);
		}
		return false;
	};

	if (walk(error)) {
		return true;
	}

	if (error instanceof Error && error.message === "fetch failed") {
		return walk((error as Error & { cause?: unknown }).cause);
	}

	return false;
}

/**
 * True when Convex says the function is not on this deployment (API newer than backend,
 * or NEXT_PUBLIC_CONVEX_URL points at a different deployment than the one you pushed).
 */
export function isConvexFunctionNotFoundError(error: unknown): boolean {
	const msg =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	return (
		msg.includes("Could not find public function") ||
		msg.includes("Could not find function")
	);
}
