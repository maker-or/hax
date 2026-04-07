export declare const getByAuthId: import("convex/server").RegisteredQuery<"internal", {
    authId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"organizationMembers">;
    _creationTime: number;
    updatedAt: number;
    orgId: import("convex/values").GenericId<"organisation">;
    userId: string;
    role: "admin" | "member";
} | null>>;
export declare const createDesktopSession: import("convex/server").RegisteredMutation<"public", {
    organizationId?: string | undefined;
    lastAccessTokenExpiresAt?: number | undefined;
    deviceName?: string | undefined;
    platform?: string | undefined;
    userId: string;
    sessionId: string;
    secretHash: string;
    refreshToken: string;
}, Promise<string>>;
export declare const getDesktopSessionForTokenBroker: import("convex/server").RegisteredQuery<"public", {
    sessionId: string;
    secretHash: string;
}, Promise<{
    encryptedRefreshToken: string;
    organizationId: string | undefined;
} | null>>;
export declare const rotateDesktopSessionRefreshToken: import("convex/server").RegisteredMutation<"public", {
    organizationId?: string | undefined;
    lastAccessTokenExpiresAt?: number | undefined;
    sessionId: string;
    secretHash: string;
    refreshToken: string;
}, Promise<null>>;
//# sourceMappingURL=users.d.ts.map