"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotateDesktopSessionRefreshToken = exports.getDesktopSessionForTokenBroker = exports.createDesktopSession = exports.getByAuthId = void 0;
const values_1 = require("convex/values");
const encryption_1 = require("./lib/encryption");
const server_1 = require("./_generated/server");
exports.getByAuthId = (0, server_1.internalQuery)({
    args: { authId: values_1.v.string() },
    handler: async (ctx, { authId }) => {
        return await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", authId))
            .first();
    },
});
exports.createDesktopSession = (0, server_1.mutation)({
    args: {
        sessionId: values_1.v.string(),
        userId: values_1.v.string(),
        secretHash: values_1.v.string(),
        refreshToken: values_1.v.string(),
        organizationId: values_1.v.optional(values_1.v.string()),
        lastAccessTokenExpiresAt: values_1.v.optional(values_1.v.number()),
        deviceName: values_1.v.optional(values_1.v.string()),
        platform: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.string(),
    handler: async (ctx, args) => {
        const encryptedRefreshToken = await (0, encryption_1.encrypt)(args.refreshToken);
        await ctx.db.insert("desktopSessions", {
            sessionId: args.sessionId,
            userId: args.userId,
            secretHash: args.secretHash,
            encryptedRefreshToken,
            organizationId: args.organizationId,
            lastAccessTokenExpiresAt: args.lastAccessTokenExpiresAt,
            deviceName: args.deviceName,
            platform: args.platform,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            updatedAt: Date.now(),
        });
        return args.sessionId;
    },
});
exports.getDesktopSessionForTokenBroker = (0, server_1.query)({
    args: {
        sessionId: values_1.v.string(),
        secretHash: values_1.v.string(),
    },
    returns: values_1.v.union(values_1.v.object({
        encryptedRefreshToken: values_1.v.string(),
        organizationId: values_1.v.optional(values_1.v.string()),
    }), values_1.v.null()),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("desktopSessions")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
            .first();
        if (!session || session.revokedAt || session.secretHash !== args.secretHash) {
            return null;
        }
        return {
            encryptedRefreshToken: session.encryptedRefreshToken,
            organizationId: session.organizationId,
        };
    },
});
exports.rotateDesktopSessionRefreshToken = (0, server_1.mutation)({
    args: {
        sessionId: values_1.v.string(),
        secretHash: values_1.v.string(),
        refreshToken: values_1.v.string(),
        organizationId: values_1.v.optional(values_1.v.string()),
        lastAccessTokenExpiresAt: values_1.v.optional(values_1.v.number()),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("desktopSessions")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
            .first();
        if (!session || session.revokedAt || session.secretHash !== args.secretHash) {
            throw new Error("Desktop session is invalid.");
        }
        const encryptedRefreshToken = await (0, encryption_1.encrypt)(args.refreshToken);
        await ctx.db.patch(session._id, {
            encryptedRefreshToken,
            organizationId: args.organizationId,
            lastAccessTokenExpiresAt: args.lastAccessTokenExpiresAt,
            lastUsedAt: Date.now(),
            updatedAt: Date.now(),
        });
        return null;
    },
});
//# sourceMappingURL=users.js.map