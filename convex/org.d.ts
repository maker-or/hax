/**
 * Add a member to an organisation. Only callable internally (e.g. from
 * onboarding actions via Convex internal mutations) — not exposed publicly so
 * callers cannot arbitrarily add themselves or others to orgs.
 */
export declare const addMember: import("convex/server").RegisteredMutation<"internal", {
    orgId: import("convex/values").GenericId<"organisation">;
    userId: string;
    role: "admin" | "member";
}, Promise<import("convex/values").GenericId<"organizationMembers">>>;
/**
 * Look up the caller's own membership. Only returns the membership for the
 * authenticated user — callers cannot query membership for arbitrary user IDs.
 */
export declare const getMyMembership: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    _id: import("convex/values").GenericId<"organizationMembers">;
    _creationTime: number;
    updatedAt: number;
    orgId: import("convex/values").GenericId<"organisation">;
    userId: string;
    role: "admin" | "member";
} | null>>;
/**
 * Check whether a userId has a membership — used by the server-side auth
 * callback (route.ts) to decide whether to send the user to /onboarding.
 * Returns only a boolean so no sensitive org data is leaked.
 */
export declare const hasMembership: import("convex/server").RegisteredQuery<"public", {
    userId: string;
}, Promise<boolean>>;
/**
 * Step 1 of onboarding: create the Convex org record and immediately add the
 * caller (from ctx.auth) as admin. Returns the new Convex org ID so the
 * caller can create the matching WorkOS organisation using that ID as
 * externalId, then patch it back.
 */
export declare const createOrgAndAddAdmin: import("convex/server").RegisteredMutation<"public", {
    name: string;
}, Promise<{
    orgId: import("convex/values").GenericId<"organisation">;
    memberId: import("convex/values").GenericId<"organizationMembers">;
}>>;
/**
 * Step 2 of onboarding: write the WorkOS organisation ID back onto the Convex
 * org record after the WorkOS org has been created server-side.
 * Only the admin of the org may call this.
 */
export declare const patchWorkosOrgId: import("convex/server").RegisteredMutation<"public", {
    workosOrgId: string;
    orgId: import("convex/values").GenericId<"organisation">;
}, Promise<null>>;
export declare const getOrganisationByUserId: import("convex/server").RegisteredQuery<"internal", {
    userId: string;
}, Promise<{
    organisation: {
        _id: import("convex/values").GenericId<"organisation">;
        _creationTime: number;
        dodocustomerId?: string | undefined;
        workosOrgId?: string | undefined;
        name: string;
        updatedAt: number;
    };
    membership: {
        _id: import("convex/values").GenericId<"organizationMembers">;
        _creationTime: number;
        updatedAt: number;
        orgId: import("convex/values").GenericId<"organisation">;
        userId: string;
        role: "admin" | "member";
    };
} | null>>;
//# sourceMappingURL=org.d.ts.map