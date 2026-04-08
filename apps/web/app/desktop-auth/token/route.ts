import { createHash } from "node:crypto";
import { isLikelyConvexConnectivityError } from "@/lib/convex-connectivity";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { decrypt } from "../../../../../convex/lib/encryption";

// biome-ignore lint/style/noNonNullAssertion: WORKOS_CLIENT_ID must be set at build time
const CLIENT_ID = process.env.WORKOS_CLIENT_ID!;

function hashDesktopSecret(secret: string) {
	return createHash("sha256").update(secret, "utf8").digest("hex");
}

function decodeAccessTokenClaims(token: string) {
	const payload = token.split(".")[1];
	if (!payload) {
		throw new Error("WorkOS access token is missing a payload.");
	}

	return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
		exp?: number;
		org_id?: string;
	};
}

/**
 * This checks whether WorkOS rejected the desktop refresh token because the
 * desktop session has already ended and needs a fresh sign-in.
 */
function isEndedDesktopSessionError(error: unknown) {
	if (!error || typeof error !== "object") {
		return false;
	}

	const candidate = error as {
		error?: unknown;
		errorDescription?: unknown;
	};

	return (
		candidate.error === "invalid_grant" &&
		candidate.errorDescription === "Session has already ended."
	);
}

export async function POST(request: NextRequest) {
	const body = (await request.json().catch(() => null)) as {
		desktopSecret?: string;
		desktopSessionId?: string;
	} | null;

	if (!body?.desktopSessionId || !body.desktopSecret) {
		return NextResponse.json(
			{ error: "Missing desktop session credentials" },
			{ status: 400 },
		);
	}

	const secretHash = hashDesktopSecret(body.desktopSecret);

	let desktopSession: FunctionReturnType<
		typeof api.users.getDesktopSessionForTokenBroker
	>;
	try {
		desktopSession = await fetchQuery(
			api.users.getDesktopSessionForTokenBroker,
			{
				sessionId: body.desktopSessionId,
				secretHash,
			},
		);
	} catch (error) {
		if (isLikelyConvexConnectivityError(error)) {
			console.error("[desktop-auth/token] Convex unreachable:", error);
			return NextResponse.json(
				{
					error: "Could not reach Convex.",
					detail:
						"Connection timed out or failed. Check network, VPN, and firewall; confirm NEXT_PUBLIC_CONVEX_URL matches your deployment.",
				},
				{ status: 503 },
			);
		}
		throw error;
	}

	if (!desktopSession) {
		return NextResponse.json(
			{ error: "Desktop session is invalid or expired" },
			{ status: 401 },
		);
	}

	try {
		const refreshToken = await decrypt(desktopSession.encryptedRefreshToken);
		const refreshResult =
			await getWorkOS().userManagement.authenticateWithRefreshToken({
				clientId: CLIENT_ID,
				refreshToken,
				organizationId: desktopSession.organizationId,
			});

		const claims = decodeAccessTokenClaims(refreshResult.accessToken);

		await fetchMutation(api.users.rotateDesktopSessionRefreshToken, {
			sessionId: body.desktopSessionId,
			secretHash,
			refreshToken: refreshResult.refreshToken,
			organizationId: claims.org_id,
			lastAccessTokenExpiresAt: claims.exp ? claims.exp * 1000 : undefined,
		});

		return NextResponse.json({
			ok: true,
			accessToken: refreshResult.accessToken,
			expiresAt: claims.exp ? claims.exp * 1000 : null,
		});
	} catch (error) {
		console.error("[desktop-auth/token] refresh failed:", error);

		if (isLikelyConvexConnectivityError(error)) {
			return NextResponse.json(
				{
					error: "Could not reach Convex.",
					detail:
						"Connection timed out while updating the session. Check network and NEXT_PUBLIC_CONVEX_URL.",
				},
				{ status: 503 },
			);
		}

		if (isEndedDesktopSessionError(error)) {
			return NextResponse.json(
				{
					error: "Hax desktop session ended. Sign in with Hax again.",
					detail: "Session has already ended.",
				},
				{ status: 401 },
			);
		}

		return NextResponse.json(
			{
				error: "Failed to refresh desktop access token",
				detail: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
