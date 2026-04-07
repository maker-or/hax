"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const values_1 = require("convex/values");
const providerValidator = values_1.v.union(values_1.v.literal("openai-codex"), values_1.v.literal("anthropic"), values_1.v.literal("github-copilot"), values_1.v.literal("google-gemini-cli"));
exports.default = (0, server_1.defineSchema)({
    organisation: (0, server_1.defineTable)({
        name: values_1.v.string(),
        dodocustomerId: values_1.v.optional(values_1.v.string()),
        workosOrgId: values_1.v.optional(values_1.v.string()),
        updatedAt: values_1.v.number(),
    })
        .index("by_workosOrgId", ["workosOrgId"])
        .index("by_dodocustomerId", ["dodocustomerId"]),
    organizationMembers: (0, server_1.defineTable)({
        orgId: values_1.v.id("organisation"),
        userId: values_1.v.string(),
        role: values_1.v.union(values_1.v.literal("admin"), values_1.v.literal("member")),
        updatedAt: values_1.v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_orgId_userId", ["orgId", "userId"]),
    secretkey: (0, server_1.defineTable)({
        orgId: values_1.v.id("organisation"),
        userId: values_1.v.string(),
        name: values_1.v.string(),
        prefix: values_1.v.string(),
        hashedKey: values_1.v.string(),
        publicId: values_1.v.string(),
        revokedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_publicId", ["publicId"])
        .index("by_userId", ["userId"]),
    consoleApp: (0, server_1.defineTable)({
        workosAppId: values_1.v.string(),
        workosClientId: values_1.v.string(),
        name: values_1.v.string(),
        /** Allowed frontend origins (browser) for this app — Convex-only; not synced to WorkOS. */
        domains: values_1.v.optional(values_1.v.array(values_1.v.string())),
        redirectUri: values_1.v.array(values_1.v.object({
            uri: values_1.v.string(),
            default: values_1.v.boolean(),
        })),
        userId: values_1.v.string(),
        updatedAt: values_1.v.number(),
        orgId: values_1.v.id("organisation"),
    })
        .index("by_userId", ["userId"])
        .index("by_orgId", ["orgId"])
        .index("by_workosAppId", ["workosAppId"])
        .index("by_workosClientId", ["workosClientId"]),
    aicrendital: (0, server_1.defineTable)({
        userId: values_1.v.string(),
        orgId: values_1.v.id("organisation"),
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
        updatedAt: values_1.v.number(),
    })
        .index("by_userId", ["userId"])
        .index("by_userId_provider", ["userId", "provider"])
        .index("by_orgId_provider", ["orgId", "provider"]),
    desktopSessions: (0, server_1.defineTable)({
        sessionId: values_1.v.string(),
        userId: values_1.v.string(),
        secretHash: values_1.v.string(),
        encryptedRefreshToken: values_1.v.string(),
        organizationId: values_1.v.optional(values_1.v.string()),
        lastAccessTokenExpiresAt: values_1.v.optional(values_1.v.number()),
        revokedAt: values_1.v.optional(values_1.v.number()),
        deviceName: values_1.v.optional(values_1.v.string()),
        platform: values_1.v.optional(values_1.v.string()),
        createdAt: values_1.v.number(),
        lastUsedAt: values_1.v.number(),
        updatedAt: values_1.v.number(),
    })
        .index("by_sessionId", ["sessionId"])
        .index("by_userId", ["userId"]),
    // still think this is temporary because we can use the normal ts file for the limits
    planconfig: (0, server_1.defineTable)({
        plan: values_1.v.union(values_1.v.literal("starter"), values_1.v.literal("pro"), values_1.v.literal("plus")),
        price_usd_cents: values_1.v.number(),
        monthly_limit: values_1.v.number(),
        four_hrs_limit: values_1.v.number(),
        dodo_productId: values_1.v.string(),
        dodo_seatAddonId: values_1.v.string(),
        updatedAt: values_1.v.optional(values_1.v.number()),
    }),
    subscription: (0, server_1.defineTable)({
        orgId: values_1.v.id("organisation"),
        plan: values_1.v.union(values_1.v.literal("starter"), values_1.v.literal("pro"), values_1.v.literal("plus")),
        status: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("cancelled"), values_1.v.literal("on_hold"), values_1.v.literal("expired"), values_1.v.literal("failed"), values_1.v.literal("pending")),
        cycle_startedAt: values_1.v.number(),
        cycle_endedAt: values_1.v.number(),
        seatCount: values_1.v.number(),
        dodo_subscriptionId: values_1.v.string(),
        dodo_customerId: values_1.v.string(),
        updatedAt: values_1.v.optional(values_1.v.number()),
    })
        .index("by_orgId", ["orgId"])
        .index("by_dodo_subscriptionId", ["dodo_subscriptionId"])
        .index("by_dodo_customerId", ["dodo_customerId"])
        .index("by_seatCount", ["seatCount"])
        .index("by_status", ["status"]),
    // this is incomplete i haven't thought about the flow
    invitation: (0, server_1.defineTable)({
        orgId: values_1.v.id("organisation"),
        invitedBy: values_1.v.string(), // userId
        email: values_1.v.string(),
        role: values_1.v.string(),
    }),
    member_credits: (0, server_1.defineTable)({
        orgId: values_1.v.id("organisation"),
        subscriptionId: values_1.v.id("subscription"),
        userId: values_1.v.string(),
        monthly_credits: values_1.v.number(),
        used_credits: values_1.v.number(),
        reserved_credits: values_1.v.number(),
    }),
});
//# sourceMappingURL=schema.js.map