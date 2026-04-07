export declare const genrateKey: import("convex/server").RegisteredMutation<"public", {
    name: string;
}, Promise<{
    publicId: string;
    fullKey: string;
}>>;
export declare const listApiKeys: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    _id: import("convex/values").GenericId<"secretkey">;
    name: string;
    publicId: string;
    prefix: string;
    createdAt: number;
}[]>>;
export declare const publicaction: import("convex/server").PublicHttpAction;
export declare const verifyApiKey: import("convex/server").RegisteredQuery<"internal", {
    hashedKey: string;
    token: string;
}, Promise<{
    valid: boolean;
    userId?: undefined;
} | {
    valid: boolean;
    userId: string | null;
}>>;
export declare const deleteApiKey: import("convex/server").RegisteredMutation<"public", {
    keyId: import("convex/values").GenericId<"secretkey">;
}, Promise<void>>;
//# sourceMappingURL=secert.d.ts.map