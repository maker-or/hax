import type { Hook } from "@oclif/core";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../lib/package-info.js";
import { maybePrintUpdateNotice } from "../lib/version-check.js";

/**
 * After each command, optionally notifies when a newer CLI is published.
 */
const hook: Hook<"postrun"> = async function postrun() {
	await maybePrintUpdateNotice({
		currentVersion: PACKAGE_VERSION,
		packageName: PACKAGE_NAME,
	});
};

export default hook;
