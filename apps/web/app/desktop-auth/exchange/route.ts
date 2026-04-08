import { isLikelyConvexConnectivityError } from "@/lib/convex-connectivity";
import { fetchMutation } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";

export async function POST(request: NextRequest) {
	const body = (await request.json().catch(() => null)) as {
		code?: string;
		state?: string;
	} | null;

	if (!body?.code || !body.state) {
		return NextResponse.json(
			{ error: "Missing desktop auth code or state" },
			{ status: 400 },
		);
	}

	let record: FunctionReturnType<
		typeof api.desktopHandoff.consumeDesktopAuthHandoff
	>;
	try {
		record = await fetchMutation(api.desktopHandoff.consumeDesktopAuthHandoff, {
			code: body.code,
		});
	} catch (error) {
		if (isLikelyConvexConnectivityError(error)) {
			console.error("[desktop-auth/exchange] Convex unreachable:", error);
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

	if (!record) {
		return NextResponse.json(
			{ error: "Desktop handoff has expired or was already used" },
			{ status: 404 },
		);
	}

	let user: Record<string, unknown>;
	try {
		user = JSON.parse(record.userJson) as Record<string, unknown>;
	} catch {
		return NextResponse.json(
			{ error: "Invalid desktop handoff payload" },
			{ status: 500 },
		);
	}

	return NextResponse.json({
		ok: true,
		accessToken: record.accessToken,
		desktopSecret: record.desktopSecret,
		desktopSessionId: record.desktopSessionId,
		state: body.state,
		tokenExpiresAt: record.tokenExpiresAt,
		user,
	});
}
