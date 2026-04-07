"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripLegacyConsoleAppDescription = void 0;
/**
 * One-off data migrations. Run with:
 * `npx convex run migrations:stripLegacyConsoleAppDescription`
 * after removing `description` from the `consoleApp` schema.
 */
const values_1 = require("convex/values");
const server_1 = require("./_generated/server");
exports.stripLegacyConsoleAppDescription = (0, server_1.internalMutation)({
    args: {},
    returns: values_1.v.null(),
    handler: async (ctx) => {
        const apps = await ctx.db.query("consoleApp").collect();
        for (const a of apps) {
            const legacy = a;
            if (legacy.description === undefined)
                continue;
            await ctx.db.replace(a._id, {
                workosAppId: a.workosAppId,
                workosClientId: a.workosClientId,
                name: a.name,
                domains: a.domains ?? [],
                redirectUri: a.redirectUri,
                userId: a.userId,
                updatedAt: Date.now(),
                orgId: a.orgId,
            });
        }
        return null;
    },
});
//# sourceMappingURL=migrations.js.map