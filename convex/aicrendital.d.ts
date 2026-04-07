export declare const createCredential: import("convex/server").RegisteredMutation<"public", {
    expiresAt?: number | undefined;
    provider_subscriptionType?: string | undefined;
    provider_user_id?: string | undefined;
    provider_account_id?: string | undefined;
    provider_sub_active_start?: string | undefined;
    provider_sub_active_until?: string | undefined;
    token_id?: string | undefined;
    refresh_token?: string | undefined;
    accessToken: string;
    provider: "openai-codex" | "anthropic" | "github-copilot" | "google-gemini-cli";
}, Promise<import("convex/values").GenericId<"aicrendital">>>;
export declare const getCredential: import("convex/server").PublicHttpAction;
export declare const getinfo: import("convex/server").RegisteredQuery<"internal", {
    userId: string;
    provider: "openai-codex" | "anthropic" | "github-copilot" | "google-gemini-cli";
}, Promise<{
    _id: import("convex/values").GenericId<"aicrendital">;
    _creationTime: number;
    expiresAt?: number | undefined;
    provider_subscriptionType?: string | undefined;
    provider_user_id?: string | undefined;
    provider_account_id?: string | undefined;
    provider_sub_active_start?: string | undefined;
    provider_sub_active_until?: string | undefined;
    token_id?: string | undefined;
    refresh_token?: string | undefined;
    accessToken: string;
    updatedAt: number;
    orgId: import("convex/values").GenericId<"organisation">;
    userId: string;
    provider: "openai-codex" | "anthropic" | "github-copilot" | "google-gemini-cli";
} | null>>;
//# sourceMappingURL=aicrendital.d.ts.map