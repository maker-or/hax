import { redirect } from "next/navigation";

/**
 * Console is a standalone sub-app focused only on OAuth apps.
 * This route sends users straight to the apps list.
 */
export default function ConsolePage() {
	redirect("/console/apps");
}
