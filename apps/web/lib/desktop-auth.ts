type DesktopStatePayload = {
	callbackUrl: string;
	flow: "desktop";
	state: string;
};

/**
 * Encodes callback URL and CSRF state for the desktop OAuth-style redirect (used in `/desktop-auth/start`).
 */
export function encodeDesktopState({
	callbackUrl,
	state,
}: {
	callbackUrl: string;
	state: string;
}) {
	const payload: DesktopStatePayload = {
		callbackUrl,
		flow: "desktop",
		state,
	};

	return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Decodes the `state` query param from WorkOS redirect into callback URL and desktop flow metadata.
 */
export function decodeDesktopState(encodedState?: string | null) {
	if (!encodedState) {
		return null;
	}

	try {
		const parsed = JSON.parse(
			Buffer.from(encodedState, "base64url").toString("utf8"),
		) as DesktopStatePayload;

		if (parsed.flow !== "desktop" || !parsed.state || !parsed.callbackUrl) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

/**
 * Only http loopback callbacks are allowed for the CLI local server.
 */
export function isAllowedDesktopCallbackUrl(callbackUrl: string) {
	try {
		const url = new URL(callbackUrl);
		return (
			url.protocol === "http:" &&
			(url.hostname === "127.0.0.1" || url.hostname === "localhost")
		);
	} catch {
		return false;
	}
}
