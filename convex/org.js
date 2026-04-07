"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganisationByUserId = exports.patchWorkosOrgId = exports.createOrgAndAddAdmin = exports.hasMembership = exports.getMyMembership = exports.addMember = void 0;
const values_1 = require("convex/values");
const server_1 = require("./_generated/server");
/**
 * Add a member to an organisation. Only callable internally (e.g. from
 * onboarding actions via Convex internal mutations) — not exposed publicly so
 * callers cannot arbitrarily add themselves or others to orgs.
 */
exports.addMember = (0, server_1.internalMutation)({
    args: {
        orgId: values_1.v.id("organisation"),
        userId: values_1.v.string(),
        role: values_1.v.union(values_1.v.literal("admin"), values_1.v.literal("member")),
    },
    returns: values_1.v.id("organizationMembers"),
    handler: async (ctx, args) => {
        const member = await ctx.db.insert("organizationMembers", {
            orgId: args.orgId,
            userId: args.userId,
            role: args.role,
            updatedAt: Date.now(),
        });
        return member;
    },
});
/**
 * Look up the caller's own membership. Only returns the membership for the
 * authenticated user — callers cannot query membership for arbitrary user IDs.
 */
exports.getMyMembership = (0, server_1.query)({
    args: {},
    returns: values_1.v.union(values_1.v.object({
        _id: values_1.v.id("organizationMembers"),
        _creationTime: values_1.v.number(),
        orgId: values_1.v.id("organisation"),
        userId: values_1.v.string(),
        role: values_1.v.union(values_1.v.literal("admin"), values_1.v.literal("member")),
        updatedAt: values_1.v.number(),
    }), values_1.v.null()),
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        return membership ?? null;
    },
});
/**
 * Check whether a userId has a membership — used by the server-side auth
 * callback (route.ts) to decide whether to send the user to /onboarding.
 * Returns only a boolean so no sensitive org data is leaked.
 */
exports.hasMembership = (0, server_1.query)({
    args: {
        userId: values_1.v.string(),
    },
    returns: values_1.v.boolean(),
    handler: async (ctx, args) => {
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();
        return membership !== null;
    },
});
/**
 * Step 1 of onboarding: create the Convex org record and immediately add the
 * caller (from ctx.auth) as admin. Returns the new Convex org ID so the
 * caller can create the matching WorkOS organisation using that ID as
 * externalId, then patch it back.
 */
exports.createOrgAndAddAdmin = (0, server_1.mutation)({
    args: {
        name: values_1.v.string(),
    },
    returns: values_1.v.object({
        orgId: values_1.v.id("organisation"),
        memberId: values_1.v.id("organizationMembers"),
    }),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        // Guard: a user should only ever have one org in the MVP
        const existing = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (existing) {
            throw new values_1.ConvexError({
                code: "ALREADY_EXISTS",
                message: "User already belongs to an organisation",
            });
        }
        const orgId = await ctx.db.insert("organisation", {
            name: args.name,
            updatedAt: Date.now(),
        });
        const memberId = await ctx.db.insert("organizationMembers", {
            orgId,
            userId,
            role: "admin",
            updatedAt: Date.now(),
        });
        return { orgId, memberId };
    },
});
/**
 * Step 2 of onboarding: write the WorkOS organisation ID back onto the Convex
 * org record after the WorkOS org has been created server-side.
 * Only the admin of the org may call this.
 */
exports.patchWorkosOrgId = (0, server_1.mutation)({
    args: {
        orgId: values_1.v.id("organisation"),
        workosOrgId: values_1.v.string(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        // Verify the caller is an admin member of the target org
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_orgId_userId", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
            .first();
        if (!membership) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You are not a member of this organisation",
            });
        }
        if (membership.role !== "admin") {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: "Only admins can update the WorkOS org ID",
            });
        }
        const org = await ctx.db.get(args.orgId);
        if (!org) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: "Organisation not found",
            });
        }
        await ctx.db.patch(args.orgId, {
            workosOrgId: args.workosOrgId,
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.getOrganisationByUserId = (0, server_1.internalQuery)({
    args: {
        userId: values_1.v.string(),
    },
    returns: values_1.v.union(values_1.v.object({
        organisation: values_1.v.object({
            _id: values_1.v.id("organisation"),
            _creationTime: values_1.v.number(),
            name: values_1.v.string(),
            dodocustomerId: values_1.v.optional(values_1.v.string()),
            workosOrgId: values_1.v.optional(values_1.v.string()),
            updatedAt: values_1.v.number(),
        }),
        membership: values_1.v.object({
            _id: values_1.v.id("organizationMembers"),
            _creationTime: values_1.v.number(),
            orgId: values_1.v.id("organisation"),
            userId: values_1.v.string(),
            role: values_1.v.union(values_1.v.literal("admin"), values_1.v.literal("member")),
            updatedAt: values_1.v.number(),
        }),
    }), values_1.v.null()),
    handler: async (ctx, args) => {
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();
        if (!membership)
            return null;
        const organisation = await ctx.db.get(membership.orgId);
        if (!organisation)
            return null;
        return {
            organisation,
            membership,
        };
    },
});
//# sourceMappingURL=org.js.map