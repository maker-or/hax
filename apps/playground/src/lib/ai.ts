import { create } from "@hax/ai";
import type { CreateClientOptionsType } from "@hax/ai";

/**
 * This creates a Hax AI client for the playground using the same options as `create()` from `@hax/ai`.
 */
export function createPlaygroundHaxClient(options: CreateClientOptionsType) {
	return create(options);
}
