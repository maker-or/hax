import { createHash, randomUUID } from "node:crypto";
import {
	isConvexFunctionNotFoundError,
	isLikelyConvexConnectivityError,
} from "@/lib/convex-connectivity";
import { isAllowedDesktopCallbackUrl } from "@/lib/desktop-auth";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { fetchMutation } from "convex/nextjs";
import { unsealData } from "iron-session";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";

type WorkosSessionCookie = {
	accessToken: string;
	refreshToken: string;
	user: Record<string, unknown>;
};

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

async function readWorkosSessionCookie() {
	const cookieName = process.env.WORKOS_COOKIE_NAME || "wos-session";
	const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
	if (!cookiePassword) {
		throw new Error("WORKOS_COOKIE_PASSWORD is not configured.");
	}

	const cookie = (await cookies()).get(cookieName);
	if (!cookie) {
		return null;
	}

	return unsealData<WorkosSessionCookie>(cookie.value, {
		password: cookiePassword,
	});
}

function hashDesktopSecret(secret: string) {
	return createHash("sha256").update(secret, "utf8").digest("hex");
}

export async function GET(request: NextRequest) {
	const desktopCallbackUrl = request.nextUrl.searchParams.get("callback_url");
	const desktopState = request.nextUrl.searchParams.get("state");

	if (!desktopState || !desktopCallbackUrl) {
		return NextResponse.json(
			{ error: "Missing desktop auth state" },
			{ status: 400 },
		);
	}

	if (!isAllowedDesktopCallbackUrl(desktopCallbackUrl)) {
		return NextResponse.json(
			{ error: "Invalid desktop callback URL" },
			{ status: 400 },
		);
	}

	try {
		const session = await withAuth({ ensureSignedIn: true });
		const storedSession = await readWorkosSessionCookie();
		if (!storedSession?.refreshToken) {
			return NextResponse.json(
				{ error: "WorkOS refresh token is unavailable for desktop auth" },
				{ status: 500 },
			);
		}

		const desktopSessionId = randomUUID();
		const desktopSecret = randomUUID();
		const claims = decodeAccessTokenClaims(session.accessToken);

		await fetchMutation(api.users.createDesktopSession, {
			sessionId: desktopSessionId,
			userId: session.user.id,
			secretHash: hashDesktopSecret(desktopSecret),
			refreshToken: storedSession.refreshToken,
			organizationId: claims.org_id,
			lastAccessTokenExpiresAt: claims.exp ? claims.exp * 1000 : undefined,
			deviceName: "Hax Desktop",
			platform: request.headers.get("user-agent") ?? "desktop",
		});

		let userJson: string;
		try {
			userJson = JSON.stringify(session.user, (_key, value) =>
				typeof value === "bigint" ? value.toString() : value,
			);
		} catch {
			return NextResponse.json(
				{ error: "Could not serialize user profile for desktop handoff." },
				{ status: 500 },
			);
		}

		const code = randomUUID();
		await fetchMutation(api.desktopHandoff.createDesktopAuthHandoff, {
			code,
			accessToken: session.accessToken,
			desktopSecret,
			desktopSessionId,
			tokenExpiresAt: claims.exp ? claims.exp * 1000 : Date.now(),
			userJson,
		});

		const callbackUrl = new URL(desktopCallbackUrl);
		callbackUrl.searchParams.set("code", code);
		callbackUrl.searchParams.set("state", desktopState);

		return NextResponse.redirect(callbackUrl, { status: 302 });
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		console.error("[desktop-auth/complete]", detail);

		if (isLikelyConvexConnectivityError(error)) {
			return NextResponse.json(
				{
					error: "Cannot reach Convex.",
					detail:
						"Check network, VPN, firewall, and that NEXT_PUBLIC_CONVEX_URL is correct.",
				},
				{ status: 503 },
			);
		}

		if (isConvexFunctionNotFoundError(error)) {
			return NextResponse.json(
				{
					error: "Convex deployment is missing desktop auth functions.",
					detail:
						"Push the latest Convex code to the deployment used by NEXT_PUBLIC_CONVEX_URL (e.g. `bunx convex deploy` or `bunx convex dev`).",
				},
				{ status: 503 },
			);
		}

		return NextResponse.json(
			{
				error: "Desktop auth completion failed.",
				detail,
			},
			{ status: 500 },
		);
	}
}
