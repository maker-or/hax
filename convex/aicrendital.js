"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getinfo = exports.getCredential = exports.createCredential = void 0;
const values_1 = require("convex/values");
const api_1 = require("./_generated/api");
const server_1 = require("./_generated/server");
const encryption_1 = require("./lib/encryption");
const providerValidator = values_1.v.union(values_1.v.literal("openai-codex"), values_1.v.literal("anthropic"), values_1.v.literal("github-copilot"), values_1.v.literal("google-gemini-cli"));
exports.createCredential = (0, server_1.mutation)({
    args: {
        provider: providerValidator,
        provider_subscriptionType: values_1.v.optional(values_1.v.string()),
        provider_user_id: values_1.v.optional(values_1.v.string()),
        provider_account_id: values_1.v.optional(values_1.v.string()),
        provider_sub_active_start: values_1.v.optional(values_1.v.string()),
        provider_sub_active_until: values_1.v.optional(values_1.v.string()),
        accessToken: values_1.v.string(),
        token_id: values_1.v.optional(values_1.v.string()),
        refresh_token: values_1.v.optional(values_1.v.string()),
        expiresAt: values_1.v.optional(values_1.v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Unauthenticated");
        }
        const userId = identity.subject;
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!membership) {
            throw new Error("User does not belong to any organisation");
        }
        const [encryptedAccessToken, encryptedTokenId, encryptedRefreshToken] = await Promise.all([
            (0, encryption_1.encrypt)(args.accessToken),
            args.token_id ? (0, encryption_1.encrypt)(args.token_id) : Promise.resolve(undefined),
            args.refresh_token
                ? (0, encryption_1.encrypt)(args.refresh_token)
                : Promise.resolve(undefined),
        ]);
        const existing = await ctx.db
            .query("aicrendital")
            .withIndex("by_userId_provider", (q) => q.eq("userId", userId).eq("provider", args.provider))
            .first();
        const payload = {
            userId,
            orgId: membership.orgId,
            provider: args.provider,
            provider_subscriptionType: args.provider_subscriptionType,
            provider_user_id: args.provider_user_id,
            provider_account_id: args.provider_account_id,
            provider_sub_active_start: args.provider_sub_active_start,
            provider_sub_active_until: args.provider_sub_active_until,
            accessToken: encryptedAccessToken,
            token_id: encryptedTokenId,
            refresh_token: encryptedRefreshToken,
            expiresAt: args.expiresAt,
            updatedAt: Date.now(),
        };
        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return existing._id;
        }
        const credentialId = await ctx.db.insert("aicrendital", payload);
        return credentialId;
    },
});
exports.getCredential = (0, server_1.httpAction)(async (ctx, request) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const provider = url.searchParams.get("provider");
    if (!userId || !provider) {
        return Response.json({ error: "Missing required query params: userId, provider" }, { status: 400 });
    }
    const credential = await ctx.runQuery(api_1.internal.aicrendital.getinfo, {
        userId,
        provider,
    });
    console.log("this is afeter the credential");
    if (!credential) {
        return Response.json(null, { status: 200 });
    }
    const [accessToken, refresh_token] = await Promise.all([
        (0, encryption_1.decrypt)(credential.accessToken),
        credential.refresh_token ? (0, encryption_1.decrypt)(credential.refresh_token) : undefined,
    ]);
    return Response.json({
        ...credential,
        accessToken,
        refresh_token,
    });
});
exports.getinfo = (0, server_1.internalQuery)({
    args: {
        userId: values_1.v.string(),
        provider: providerValidator,
    },
    handler: async (ctx, args) => {
        const res = await ctx.db
            .query("aicrendital")
            .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
            .unique();
        return res;
    },
});
//# sourceMappingURL=aicrendital.js.map