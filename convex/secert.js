"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteApiKey = exports.verifyApiKey = exports.publicaction = exports.listApiKeys = exports.genrateKey = void 0;
const values_1 = require("convex/values");
const api_1 = require("./_generated/api");
const server_1 = require("./_generated/server");
const gen_1 = require("./lib/gen");
exports.genrateKey = (0, server_1.mutation)({
    args: {
        name: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        // Verify the user belongs to an organisation
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!membership)
            throw new Error("User does not belong to any organisation");
        const { key, publicId, hashsecret } = await (0, gen_1.createApiKey)();
        await ctx.db.insert("secretkey", {
            orgId: membership.orgId,
            userId,
            name: args.name,
            prefix: "sk_live_",
            hashedKey: hashsecret,
            publicId,
        });
        return {
            publicId,
            fullKey: key,
        };
    },
});
exports.listApiKeys = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        // Verify the user is an active org member before listing keys
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!membership)
            throw new Error("User does not belong to any organisation");
        // Scope keys to the org, not just the user
        const keys = await ctx.db
            .query("secretkey")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect();
        return keys
            .filter((k) => !k.revokedAt && k.orgId === membership.orgId)
            .map((k) => ({
            _id: k._id,
            name: k.name,
            publicId: k.publicId,
            prefix: k.prefix,
            createdAt: k._creationTime,
        }));
    },
});
exports.publicaction = (0, server_1.httpAction)(async (ctx, request) => {
    const payload = (await request.json());
    console.log("Got the request for publicaction");
    const rawToken = payload.token ?? "";
    const parsed = (0, gen_1.parseApiKeyToken)(rawToken);
    if (!parsed) {
        return new Response(JSON.stringify({ valid: false, userId: null }), {
            status: 401,
            headers: { "content-type": "application/json" },
        });
    }
    const response = await ctx.runQuery(api_1.internal.secert.verifyApiKey, {
        token: parsed.publicId,
        hashedKey: parsed.secret,
    });
    return new Response(JSON.stringify({
        valid: response.valid,
        userId: response.userId ?? null,
    }), {
        status: response.valid ? 200 : 401,
        headers: {
            "content-type": "application/json",
        },
    });
});
exports.verifyApiKey = (0, server_1.internalQuery)({
    args: {
        token: values_1.v.string(),
        hashedKey: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        console.log("verifying api key", args.token);
        const key = await ctx.db
            .query("secretkey")
            .withIndex("by_publicId", (q) => q.eq("publicId", args.token))
            .first();
        console.log("key found", key);
        if (!key)
            return { valid: false };
        // Reject revoked keys — revokedAt being set means the key was soft-deleted
        // if (key.revokedAt) return { valid: false };
        const isValid = await (0, gen_1.checkapiKey)(key.hashedKey, args.hashedKey);
        console.log("verifying is done we are about to return", isValid);
        return {
            valid: isValid,
            userId: isValid ? key.userId : null,
        };
    },
});
exports.deleteApiKey = (0, server_1.mutation)({
    args: {
        keyId: values_1.v.id("secretkey"),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        // Verify the user is an active org member
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!membership)
            throw new Error("User does not belong to any organisation");
        const key = await ctx.db.get(args.keyId);
        if (!key)
            throw new Error("Key not found");
        // The key must belong to the same org the user is a member of
        if (key.orgId !== membership.orgId)
            throw new Error("Unauthorized");
        await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
    },
});
//# sourceMappingURL=secert.js.map