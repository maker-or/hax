declare const _default: import("convex/server").SchemaDefinition<{
    organisation: import("convex/server").TableDefinition<import("convex/values").VObject<{
        dodocustomerId?: string | undefined;
        workosOrgId?: string | undefined;
        name: string;
        updatedAt: number;
    }, {
        name: import("convex/values").VString<string, "required">;
        dodocustomerId: import("convex/values").VString<string | undefined, "optional">;
        workosOrgId: import("convex/values").VString<string | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "name" | "dodocustomerId" | "workosOrgId" | "updatedAt">, {
        by_workosOrgId: ["workosOrgId", "_creationTime"];
        by_dodocustomerId: ["dodocustomerId", "_creationTime"];
    }, {}, {}>;
    organizationMembers: import("convex/server").TableDefinition<import("convex/values").VObject<{
        updatedAt: number;
        orgId: import("convex/values").GenericId<"organisation">;
        userId: string;
        role: "admin" | "member";
    }, {
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
        userId: import("convex/values").VString<string, "required">;
        role: import("convex/values").VUnion<"admin" | "member", [import("convex/values").VLiteral<"admin", "required">, import("convex/values").VLiteral<"member", "required">], "required", never>;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "updatedAt" | "orgId" | "userId" | "role">, {
        by_userId: ["userId", "_creationTime"];
        by_orgId_userId: ["orgId", "userId", "_creationTime"];
    }, {}, {}>;
    secretkey: import("convex/server").TableDefinition<import("convex/values").VObject<{
        revokedAt?: number | undefined;
        name: string;
        orgId: import("convex/values").GenericId<"organisation">;
        userId: string;
        prefix: string;
        hashedKey: string;
        publicId: string;
    }, {
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
        userId: import("convex/values").VString<string, "required">;
        name: import("convex/values").VString<string, "required">;
        prefix: import("convex/values").VString<string, "required">;
        hashedKey: import("convex/values").VString<string, "required">;
        publicId: import("convex/values").VString<string, "required">;
        revokedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "name" | "orgId" | "userId" | "prefix" | "hashedKey" | "publicId" | "revokedAt">, {
        by_publicId: ["publicId", "_creationTime"];
        by_userId: ["userId", "_creationTime"];
    }, {}, {}>;
    consoleApp: import("convex/server").TableDefinition<import("convex/values").VObject<{
        domains?: string[] | undefined;
        name: string;
        updatedAt: number;
        orgId: import("convex/values").GenericId<"organisation">;
        userId: string;
        workosAppId: string;
        workosClientId: string;
        redirectUri: {
            default: boolean;
            uri: string;
        }[];
    }, {
        workosAppId: import("convex/values").VString<string, "required">;
        workosClientId: import("convex/values").VString<string, "required">;
        name: import("convex/values").VString<string, "required">;
        /** Allowed frontend origins (browser) for this app — Convex-only; not synced to WorkOS. */
        domains: import("convex/values").VArray<string[] | undefined, import("convex/values").VString<string, "required">, "optional">;
        redirectUri: import("convex/values").VArray<{
            default: boolean;
            uri: string;
        }[], import("convex/values").VObject<{
            default: boolean;
            uri: string;
        }, {
            uri: import("convex/values").VString<string, "required">;
            default: import("convex/values").VBoolean<boolean, "required">;
        }, "required", "default" | "uri">, "required">;
        userId: import("convex/values").VString<string, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
    }, "required", "name" | "updatedAt" | "orgId" | "userId" | "workosAppId" | "workosClientId" | "domains" | "redirectUri">, {
        by_userId: ["userId", "_creationTime"];
        by_orgId: ["orgId", "_creationTime"];
        by_workosAppId: ["workosAppId", "_creationTime"];
        by_workosClientId: ["workosClientId", "_creationTime"];
    }, {}, {}>;
    aicrendital: import("convex/server").TableDefinition<import("convex/values").VObject<{
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
    }, {
        userId: import("convex/values").VString<string, "required">;
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
        provider: import("convex/values").VUnion<"openai-codex" | "anthropic" | "github-copilot" | "google-gemini-cli", [import("convex/values").VLiteral<"openai-codex", "required">, import("convex/values").VLiteral<"anthropic", "required">, import("convex/values").VLiteral<"github-copilot", "required">, import("convex/values").VLiteral<"google-gemini-cli", "required">], "required", never>;
        provider_subscriptionType: import("convex/values").VString<string | undefined, "optional">;
        provider_user_id: import("convex/values").VString<string | undefined, "optional">;
        provider_account_id: import("convex/values").VString<string | undefined, "optional">;
        provider_sub_active_start: import("convex/values").VString<string | undefined, "optional">;
        provider_sub_active_until: import("convex/values").VString<string | undefined, "optional">;
        accessToken: import("convex/values").VString<string, "required">;
        token_id: import("convex/values").VString<string | undefined, "optional">;
        refresh_token: import("convex/values").VString<string | undefined, "optional">;
        expiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "accessToken" | "expiresAt" | "updatedAt" | "orgId" | "userId" | "provider" | "provider_subscriptionType" | "provider_user_id" | "provider_account_id" | "provider_sub_active_start" | "provider_sub_active_until" | "token_id" | "refresh_token">, {
        by_userId: ["userId", "_creationTime"];
        by_userId_provider: ["userId", "provider", "_creationTime"];
        by_orgId_provider: ["orgId", "provider", "_creationTime"];
    }, {}, {}>;
    desktopSessions: import("convex/server").TableDefinition<import("convex/values").VObject<{
        revokedAt?: number | undefined;
        organizationId?: string | undefined;
        lastAccessTokenExpiresAt?: number | undefined;
        deviceName?: string | undefined;
        platform?: string | undefined;
        updatedAt: number;
        userId: string;
        sessionId: string;
        secretHash: string;
        encryptedRefreshToken: string;
        createdAt: number;
        lastUsedAt: number;
    }, {
        sessionId: import("convex/values").VString<string, "required">;
        userId: import("convex/values").VString<string, "required">;
        secretHash: import("convex/values").VString<string, "required">;
        encryptedRefreshToken: import("convex/values").VString<string, "required">;
        organizationId: import("convex/values").VString<string | undefined, "optional">;
        lastAccessTokenExpiresAt: import("convex/values").VFloat64<number | undefined, "optional">;
        revokedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        deviceName: import("convex/values").VString<string | undefined, "optional">;
        platform: import("convex/values").VString<string | undefined, "optional">;
        createdAt: import("convex/values").VFloat64<number, "required">;
        lastUsedAt: import("convex/values").VFloat64<number, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "updatedAt" | "userId" | "revokedAt" | "sessionId" | "secretHash" | "encryptedRefreshToken" | "organizationId" | "lastAccessTokenExpiresAt" | "deviceName" | "platform" | "createdAt" | "lastUsedAt">, {
        by_sessionId: ["sessionId", "_creationTime"];
        by_userId: ["userId", "_creationTime"];
    }, {}, {}>;
    planconfig: import("convex/server").TableDefinition<import("convex/values").VObject<{
        updatedAt?: number | undefined;
        plan: "starter" | "pro" | "plus";
        price_usd_cents: number;
        monthly_limit: number;
        four_hrs_limit: number;
        dodo_productId: string;
        dodo_seatAddonId: string;
    }, {
        plan: import("convex/values").VUnion<"starter" | "pro" | "plus", [import("convex/values").VLiteral<"starter", "required">, import("convex/values").VLiteral<"pro", "required">, import("convex/values").VLiteral<"plus", "required">], "required", never>;
        price_usd_cents: import("convex/values").VFloat64<number, "required">;
        monthly_limit: import("convex/values").VFloat64<number, "required">;
        four_hrs_limit: import("convex/values").VFloat64<number, "required">;
        dodo_productId: import("convex/values").VString<string, "required">;
        dodo_seatAddonId: import("convex/values").VString<string, "required">;
        updatedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "updatedAt" | "plan" | "price_usd_cents" | "monthly_limit" | "four_hrs_limit" | "dodo_productId" | "dodo_seatAddonId">, {}, {}, {}>;
    subscription: import("convex/server").TableDefinition<import("convex/values").VObject<{
        updatedAt?: number | undefined;
        orgId: import("convex/values").GenericId<"organisation">;
        plan: "starter" | "pro" | "plus";
        status: "active" | "cancelled" | "on_hold" | "expired" | "failed" | "pending";
        cycle_startedAt: number;
        cycle_endedAt: number;
        seatCount: number;
        dodo_subscriptionId: string;
        dodo_customerId: string;
    }, {
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
        plan: import("convex/values").VUnion<"starter" | "pro" | "plus", [import("convex/values").VLiteral<"starter", "required">, import("convex/values").VLiteral<"pro", "required">, import("convex/values").VLiteral<"plus", "required">], "required", never>;
        status: import("convex/values").VUnion<"active" | "cancelled" | "on_hold" | "expired" | "failed" | "pending", [import("convex/values").VLiteral<"active", "required">, import("convex/values").VLiteral<"cancelled", "required">, import("convex/values").VLiteral<"on_hold", "required">, import("convex/values").VLiteral<"expired", "required">, import("convex/values").VLiteral<"failed", "required">, import("convex/values").VLiteral<"pending", "required">], "required", never>;
        cycle_startedAt: import("convex/values").VFloat64<number, "required">;
        cycle_endedAt: import("convex/values").VFloat64<number, "required">;
        seatCount: import("convex/values").VFloat64<number, "required">;
        dodo_subscriptionId: import("convex/values").VString<string, "required">;
        dodo_customerId: import("convex/values").VString<string, "required">;
        updatedAt: import("convex/values").VFloat64<number | undefined, "optional">;
    }, "required", "updatedAt" | "orgId" | "plan" | "status" | "cycle_startedAt" | "cycle_endedAt" | "seatCount" | "dodo_subscriptionId" | "dodo_customerId">, {
        by_orgId: ["orgId", "_creationTime"];
        by_dodo_subscriptionId: ["dodo_subscriptionId", "_creationTime"];
        by_dodo_customerId: ["dodo_customerId", "_creationTime"];
        by_seatCount: ["seatCount", "_creationTime"];
        by_status: ["status", "_creationTime"];
    }, {}, {}>;
    invitation: import("convex/server").TableDefinition<import("convex/values").VObject<{
        orgId: import("convex/values").GenericId<"organisation">;
        role: string;
        invitedBy: string;
        email: string;
    }, {
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
        invitedBy: import("convex/values").VString<string, "required">;
        email: import("convex/values").VString<string, "required">;
        role: import("convex/values").VString<string, "required">;
    }, "required", "orgId" | "role" | "invitedBy" | "email">, {}, {}, {}>;
    member_credits: import("convex/server").TableDefinition<import("convex/values").VObject<{
        orgId: import("convex/values").GenericId<"organisation">;
        userId: string;
        subscriptionId: import("convex/values").GenericId<"subscription">;
        monthly_credits: number;
        used_credits: number;
        reserved_credits: number;
    }, {
        orgId: import("convex/values").VId<import("convex/values").GenericId<"organisation">, "required">;
        subscriptionId: import("convex/values").VId<import("convex/values").GenericId<"subscription">, "required">;
        userId: import("convex/values").VString<string, "required">;
        monthly_credits: import("convex/values").VFloat64<number, "required">;
        used_credits: import("convex/values").VFloat64<number, "required">;
        reserved_credits: import("convex/values").VFloat64<number, "required">;
    }, "required", "orgId" | "userId" | "subscriptionId" | "monthly_credits" | "used_credits" | "reserved_credits">, {}, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map