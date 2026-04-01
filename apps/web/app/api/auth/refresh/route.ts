import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// biome-ignore lint/style/noNonNullAssertion: WORKOS_CLIENT_ID must be set at build time
const CLIENT_ID = process.env.WORKOS_CLIENT_ID!;

/**
 * This reads the refresh token from the posted form body.
 */
async function readRefreshRequest(request: NextRequest) {
	const body = await request.text();
	const params = new URLSearchParams(body);
	const refreshToken = params.get("refresh_token")?.trim();

	if (!refreshToken) {
		return null;
	}

	return { refreshToken };
}

export async function POST(request: NextRequest) {
	const body = await readRefreshRequest(request);

	if (!body) {
		return NextResponse.json(
			{ error: "Missing refresh token" },
			{ status: 400 },
		);
	}

	try {
		const result =
			await getWorkOS().userManagement.authenticateWithRefreshToken({
				clientId: CLIENT_ID,
				refreshToken: body.refreshToken,
			});

		return NextResponse.json({
			access_token: result.accessToken,
			refresh_token: result.refreshToken,
		});
	} catch (error) {
		console.error("[api/auth/refresh] refresh failed:", error);
		return NextResponse.json(
			{
				error: "Failed to refresh access token",
				detail: error instanceof Error ? error.message : String(error),
			},
			{ status: 401 },
		);
	}
}
