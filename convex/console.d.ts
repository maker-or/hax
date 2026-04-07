/**
 * convex/console.ts
 *
 * Convex backend for the Developer Console — CRUD for OAuth applications.
 * All WorkOS Connect REST calls are made via raw fetch since the WorkOS Node
 * SDK does not expose typed methods for the Connect API.
 *
 * WorkOS Connect REST API base: https://api.workos.com/connect
 *
 * Debug client-secret flows (Convex dashboard logs): set env
 * `CONSOLE_DEBUG_CLIENT_SECRETS=1` on the deployment. Never logs raw secret
 * strings — only ids, last-four, timings, and overlap warnings.
 */
/** List all console apps for the authenticated user's org. */
export declare const listApps: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    _id: import("convex/values").GenericId<"consoleApp">;
    workosAppId: string;
    workosClientId: string;
    name: string;
    domains: string[];
    redirectUri: {
        default: boolean;
        uri: string;
    }[];
    createdAt: number;
    updatedAt: number;
}[]>>;
/** Get a single console app by its Convex ID. */
export declare const getApp: import("convex/server").RegisteredQuery<"public", {
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<{
    _id: import("convex/values").GenericId<"consoleApp">;
    workosAppId: string;
    workosClientId: string;
    name: string;
    domains: string[];
    redirectUri: {
        default: boolean;
        uri: string;
    }[];
    createdAt: number;
    updatedAt: number;
    orgId: import("convex/values").GenericId<"organisation">;
} | null>>;
export declare const _insertApp: import("convex/server").RegisteredMutation<"public", {
    name: string;
    orgId: import("convex/values").GenericId<"organisation">;
    userId: string;
    workosAppId: string;
    workosClientId: string;
    domains: string[];
    redirectUri: {
        default: boolean;
        uri: string;
    }[];
}, Promise<import("convex/values").GenericId<"consoleApp">>>;
export declare const _patchApp: import("convex/server").RegisteredMutation<"public", {
    name?: string | undefined;
    domains?: string[] | undefined;
    redirectUri?: {
        default: boolean;
        uri: string;
    }[] | undefined;
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<null>>;
export declare const _deleteApp: import("convex/server").RegisteredMutation<"public", {
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<null>>;
/** Create a new OAuth application in WorkOS and record it in Convex. */
export declare const createApp: import("convex/server").RegisteredAction<"public", {
    name: string;
    domains: string[];
    redirectUris: string[];
}, Promise<{
    appId: string;
    clientId: string;
}>>;
/** Update an existing OAuth application's metadata. */
export declare const updateApp: import("convex/server").RegisteredAction<"public", {
    name?: string | undefined;
    domains?: string[] | undefined;
    redirectUris?: string[] | undefined;
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<void>>;
/** Delete an OAuth application from WorkOS and Convex. */
export declare const deleteApp: import("convex/server").RegisteredAction<"public", {
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<void>>;
/** Create a new client secret for an app. Returns the secret once — store it. */
export declare const createClientSecret: import("convex/server").RegisteredAction<"public", {
    name: string;
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<{
    secretId: string;
    secret: string;
    lastFour: string;
    name: string;
    createdAt: string;
}>>;
/** List client secrets for an app (metadata only, no secret values). */
export declare const listClientSecrets: import("convex/server").RegisteredAction<"public", {
    appId: import("convex/values").GenericId<"consoleApp">;
}, Promise<{
    id: string;
    name: string;
    lastFour: string;
    createdAt: string;
}[]>>;
/** Revoke (delete) a client secret by its WorkOS secret ID. */
export declare const revokeClientSecret: import("convex/server").RegisteredAction<"public", {
    appId: import("convex/values").GenericId<"consoleApp">;
    secretId: string;
}, Promise<void>>;
export declare const getOrgRecord: import("convex/server").RegisteredQuery<"public", {
    orgId: import("convex/values").GenericId<"organisation">;
}, Promise<{
    _id: string;
    name: string;
    workosOrgId: string | undefined;
} | null>>;
//# sourceMappingURL=console.d.ts.map