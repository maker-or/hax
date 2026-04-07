"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrgRecord = exports.revokeClientSecret = exports.listClientSecrets = exports.createClientSecret = exports.deleteApp = exports.updateApp = exports.createApp = exports._deleteApp = exports._patchApp = exports._insertApp = exports.getApp = exports.listApps = void 0;
const values_1 = require("convex/values");
const api_1 = require("./_generated/api");
const server_1 = require("./_generated/server");
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
const WORKOS_API_BASE = "https://api.workos.com";
/** Fail before Convex action limits; avoids hanging forever on stalled TCP. */
const WORKOS_FETCH_TIMEOUT_MS = 45_000;
function debugClientSecretsEnabled() {
    return process.env.CONSOLE_DEBUG_CLIENT_SECRETS === "1";
}
/** Safe ids for logs — never log full secrets. */
function shortId(id, len = 12) {
    return id.length <= len ? id : `${id.slice(0, len)}…`;
}
function debugClientSecretsLog(phase, payload) {
    if (!debugClientSecretsEnabled())
        return;
    console.log(`[console][clientSecrets🔒] ${phase}`, JSON.stringify({ ...payload, ts: Date.now() }));
}
/** This function creates a short trace id so we can follow one create-secret request end to end. */
function createClientSecretTraceId() {
    return `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
/** This function writes verbose server logs for the create client secret flow. */
function logCreateClientSecretTrace(traceId, step, payload) {
    console.log(`[console][clientSecrets][trace:${traceId}] ${step}`, JSON.stringify(payload));
}
/** In-process overlap detector (best-effort; helps spot duplicate concurrent calls). */
const debugInFlight = new Map();
function debugLockEnter(lockKey, op) {
    if (!debugClientSecretsEnabled())
        return;
    const n = (debugInFlight.get(lockKey) ?? 0) + 1;
    debugInFlight.set(lockKey, n);
    if (n > 1) {
        console.warn(`[console][clientSecrets🔒] concurrent_${op}`, JSON.stringify({ lockKey, depth: n, ts: Date.now() }));
    }
}
function debugLockLeave(lockKey) {
    if (!debugClientSecretsEnabled())
        return;
    const n = (debugInFlight.get(lockKey) ?? 1) - 1;
    if (n <= 0)
        debugInFlight.delete(lockKey);
    else
        debugInFlight.set(lockKey, n);
}
/** WorkOS list endpoints may return `{ data: [...] }`, `{ client_secrets: [...] }`, or a bare array. */
function parseWorkOSClientSecretList(result) {
    if (Array.isArray(result))
        return result;
    if (result && typeof result === "object") {
        const o = result;
        if (Array.isArray(o.data))
            return o.data;
        if (Array.isArray(o.client_secrets))
            return o.client_secrets;
        if (Array.isArray(o.items))
            return o.items;
    }
    return [];
}
/** This function picks a stable display suffix for a WorkOS client secret. */
function getClientSecretLastFour(secret) {
    if (typeof secret.secret === "string" && secret.secret.length >= 4) {
        return secret.secret.slice(-4);
    }
    if (typeof secret.secret_hint === "string" &&
        secret.secret_hint.length >= 4) {
        return secret.secret_hint.slice(-4);
    }
    if (typeof secret.secret_hint === "string") {
        return secret.secret_hint;
    }
    return "";
}
/** This function creates a fallback label when WorkOS does not return a custom name. */
function getClientSecretLabel(secret, fallbackName) {
    const trimmedFallback = fallbackName.trim();
    if (trimmedFallback)
        return trimmedFallback;
    const suffix = secret.secret_hint ?? shortId(secret.id, 8);
    return `Client secret ${suffix}`;
}
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function workosHeaders() {
    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey)
        throw new Error("WORKOS_API_KEY environment variable is not set");
    return {
        Authorization: `Bearer ${apiKey}`,
    };
}
/** This function adds the JSON content type only when the request sends a body. */
function getWorkosRequestHeaders(options) {
    const headers = {
        ...workosHeaders(),
        ...options.headers,
    };
    if (options.body !== undefined && !("Content-Type" in headers)) {
        headers["Content-Type"] = "application/json";
    }
    return headers;
}
async function workosRequest(path, options = {}) {
    const url = `${WORKOS_API_BASE}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WORKOS_FETCH_TIMEOUT_MS);
    let res;
    try {
        res = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: getWorkosRequestHeaders(options),
        });
    }
    catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
            throw new values_1.ConvexError({
                code: "WORKOS_TIMEOUT",
                message: `WorkOS API request timed out after ${WORKOS_FETCH_TIMEOUT_MS / 1000}s`,
            });
        }
        throw e;
    }
    finally {
        clearTimeout(timeoutId);
    }
    if (!res.ok) {
        let detail = "";
        try {
            const body = (await res.json());
            detail = body.message ?? body.error ?? JSON.stringify(body);
        }
        catch {
            detail = await res.text();
        }
        throw new values_1.ConvexError({
            code: "WORKOS_API_ERROR",
            status: res.status,
            message: `WorkOS API error (${res.status}): ${detail}`,
        });
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
/** Normalize user-entered domain/origin to a stable origin string (http/https only). */
function normalizeAllowedOrigin(raw) {
    const s = raw.trim();
    if (!s)
        throw new values_1.ConvexError({
            code: "INVALID_DOMAIN",
            message: "Domain cannot be empty",
        });
    let url;
    try {
        url = new URL(s.includes("://") ? s : `https://${s}`);
    }
    catch {
        throw new values_1.ConvexError({
            code: "INVALID_DOMAIN",
            message: `Invalid domain or origin: ${raw}`,
        });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new values_1.ConvexError({
            code: "INVALID_DOMAIN",
            message: "Domain must use http or https",
        });
    }
    return url.origin;
}
function normalizeDomainList(domains) {
    const seen = new Set();
    const out = [];
    for (const d of domains) {
        const o = normalizeAllowedOrigin(d);
        if (!seen.has(o)) {
            seen.add(o);
            out.push(o);
        }
    }
    return out;
}
async function ensureWorkosOrg(orgId, orgName) {
    const created = await workosRequest("/organizations", {
        method: "POST",
        body: JSON.stringify({ name: orgName, external_id: orgId }),
    });
    return created.id;
}
// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
/** List all console apps for the authenticated user's org. */
exports.listApps = (0, server_1.query)({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!membership)
            throw new Error("User does not belong to any organisation");
        const apps = await ctx.db
            .query("consoleApp")
            .withIndex("by_orgId", (q) => q.eq("orgId", membership.orgId))
            .collect();
        return apps.map((a) => ({
            _id: a._id,
            workosAppId: a.workosAppId,
            workosClientId: a.workosClientId,
            name: a.name,
            domains: a.domains ?? [],
            redirectUri: a.redirectUri,
            createdAt: a._creationTime,
            updatedAt: a.updatedAt,
        }));
    },
});
/** Get a single console app by its Convex ID. */
exports.getApp = (0, server_1.query)({
    args: { appId: values_1.v.id("consoleApp") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        const membership = await ctx.db
            .query("organizationMembers")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
        if (!membership)
            throw new Error("User does not belong to any organisation");
        const app = await ctx.db.get("consoleApp", args.appId);
        if (!app)
            return null;
        if (app.orgId !== membership.orgId)
            throw new Error("Unauthorized");
        return {
            _id: app._id,
            workosAppId: app.workosAppId,
            workosClientId: app.workosClientId,
            name: app.name,
            domains: app.domains ?? [],
            redirectUri: app.redirectUri,
            createdAt: app._creationTime,
            updatedAt: app.updatedAt,
            orgId: app.orgId,
        };
    },
});
// ---------------------------------------------------------------------------
// Mutations (Convex record writes — called from actions after WorkOS API)
// ---------------------------------------------------------------------------
exports._insertApp = (0, server_1.mutation)({
    args: {
        workosAppId: values_1.v.string(),
        workosClientId: values_1.v.string(),
        name: values_1.v.string(),
        domains: values_1.v.array(values_1.v.string()),
        redirectUri: values_1.v.array(values_1.v.object({ uri: values_1.v.string(), default: values_1.v.boolean() })),
        orgId: values_1.v.id("organisation"),
        userId: values_1.v.string(),
    },
    returns: values_1.v.id("consoleApp"),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        return await ctx.db.insert("consoleApp", {
            workosAppId: args.workosAppId,
            workosClientId: args.workosClientId,
            name: args.name,
            domains: args.domains,
            redirectUri: args.redirectUri,
            orgId: args.orgId,
            userId: args.userId,
            updatedAt: Date.now(),
        });
    },
});
exports._patchApp = (0, server_1.mutation)({
    args: {
        appId: values_1.v.id("consoleApp"),
        name: values_1.v.optional(values_1.v.string()),
        domains: values_1.v.optional(values_1.v.array(values_1.v.string())),
        redirectUri: values_1.v.optional(values_1.v.array(values_1.v.object({ uri: values_1.v.string(), default: values_1.v.boolean() }))),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const { appId, ...fields } = args;
        const patch = { updatedAt: Date.now() };
        if (fields.name !== undefined)
            patch.name = fields.name;
        if (fields.domains !== undefined)
            patch.domains = fields.domains;
        if (fields.redirectUri !== undefined)
            patch.redirectUri = fields.redirectUri;
        await ctx.db.patch(appId, patch);
        return null;
    },
});
exports._deleteApp = (0, server_1.mutation)({
    args: { appId: values_1.v.id("consoleApp") },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        await ctx.db.delete(args.appId);
        return null;
    },
});
// ---------------------------------------------------------------------------
// Actions — each action does its own auth + DB lookups via ctx.runQuery
// to avoid cross-module circular references before codegen
// ---------------------------------------------------------------------------
/** Create a new OAuth application in WorkOS and record it in Convex. */
exports.createApp = (0, server_1.action)({
    args: {
        name: values_1.v.string(),
        domains: values_1.v.array(values_1.v.string()),
        redirectUris: values_1.v.array(values_1.v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const userId = identity.subject;
        // Inline membership + org lookup (avoids circular api.console refs)
        const membership = await ctx.runQuery(api_1.api.org.getMyMembership);
        if (!membership)
            throw new Error("User does not belong to any organisation");
        if (membership.role !== "admin")
            throw new Error("Only admins can create apps");
        const orgRecord = await ctx.runQuery(api_1.api.console.getOrgRecord, {
            orgId: membership.orgId,
        });
        if (!orgRecord)
            throw new Error("Organisation not found");
        let workosOrgId = orgRecord.workosOrgId;
        if (!workosOrgId) {
            workosOrgId = await ensureWorkosOrg(membership.orgId, orgRecord.name);
            await ctx.runMutation(api_1.api.org.patchWorkosOrgId, {
                orgId: membership.orgId,
                workosOrgId,
            });
        }
        const normalizedDomains = normalizeDomainList(args.domains);
        const redirectUriObjects = args.redirectUris.map((uri, i) => ({
            uri,
            default: i === 0,
        }));
        const workosApp = await workosRequest("/connect/applications", {
            method: "POST",
            body: JSON.stringify({
                name: args.name,
                application_type: "oauth",
                redirect_uris: redirectUriObjects,
                uses_pkce: false,
                is_first_party: false,
                organization_id: workosOrgId,
            }),
        });
        const convexAppId = await ctx.runMutation(api_1.api.console._insertApp, {
            workosAppId: workosApp.id,
            workosClientId: workosApp.client_id,
            name: workosApp.name,
            domains: normalizedDomains,
            redirectUri: workosApp.redirect_uris,
            orgId: membership.orgId,
            userId,
        });
        return { appId: convexAppId, clientId: workosApp.client_id };
    },
});
/** Update an existing OAuth application's metadata. */
exports.updateApp = (0, server_1.action)({
    args: {
        appId: values_1.v.id("consoleApp"),
        name: values_1.v.optional(values_1.v.string()),
        domains: values_1.v.optional(values_1.v.array(values_1.v.string())),
        redirectUris: values_1.v.optional(values_1.v.array(values_1.v.string())),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const membership = await ctx.runQuery(api_1.api.org.getMyMembership);
        if (!membership)
            throw new Error("User does not belong to any organisation");
        if (membership.role !== "admin")
            throw new Error("Only admins can update apps");
        const app = await ctx.runQuery(api_1.api.console.getApp, { appId: args.appId });
        if (!app)
            throw new Error("App not found");
        if (app.orgId !== membership.orgId)
            throw new Error("Unauthorized");
        const normalizedDomains = args.domains !== undefined
            ? normalizeDomainList(args.domains)
            : undefined;
        const workosPayload = {};
        if (args.name !== undefined)
            workosPayload.name = args.name;
        if (args.redirectUris !== undefined) {
            workosPayload.redirect_uris = args.redirectUris.map((uri, i) => ({
                uri,
                default: i === 0,
            }));
        }
        let nextName = app.name;
        let nextRedirectUri = app.redirectUri;
        if (Object.keys(workosPayload).length > 0) {
            const updated = await workosRequest(`/connect/applications/${app.workosAppId}`, { method: "PUT", body: JSON.stringify(workosPayload) });
            nextName = updated.name;
            nextRedirectUri = updated.redirect_uris;
        }
        const hasConvexPatch = Object.keys(workosPayload).length > 0 || normalizedDomains !== undefined;
        if (!hasConvexPatch) {
            throw new values_1.ConvexError({
                code: "NOTHING_TO_UPDATE",
                message: "No fields to update",
            });
        }
        await ctx.runMutation(api_1.api.console._patchApp, {
            appId: args.appId,
            ...(Object.keys(workosPayload).length > 0
                ? { name: nextName, redirectUri: nextRedirectUri }
                : {}),
            ...(normalizedDomains !== undefined
                ? { domains: normalizedDomains }
                : {}),
        });
    },
});
/** Delete an OAuth application from WorkOS and Convex. */
exports.deleteApp = (0, server_1.action)({
    args: { appId: values_1.v.id("consoleApp") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const membership = await ctx.runQuery(api_1.api.org.getMyMembership);
        if (!membership)
            throw new Error("User does not belong to any organisation");
        if (membership.role !== "admin")
            throw new Error("Only admins can delete apps");
        const app = await ctx.runQuery(api_1.api.console.getApp, { appId: args.appId });
        if (!app)
            throw new Error("App not found");
        if (app.orgId !== membership.orgId)
            throw new Error("Unauthorized");
        await workosRequest(`/connect/applications/${app.workosAppId}`, {
            method: "DELETE",
        });
        await ctx.runMutation(api_1.api.console._deleteApp, { appId: args.appId });
    },
});
/** Create a new client secret for an app. Returns the secret once — store it. */
exports.createClientSecret = (0, server_1.action)({
    args: {
        appId: values_1.v.id("consoleApp"),
        name: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const t0 = Date.now();
        const lockKey = `create:${args.appId}`;
        const traceId = createClientSecretTraceId();
        debugLockEnter(lockKey, "create");
        try {
            logCreateClientSecretTrace(traceId, "request_received", {
                appId: String(args.appId),
                requestedName: args.name,
            });
            debugClientSecretsLog("create_start", {
                appId: shortId(String(args.appId)),
                label: args.name,
            });
            const identity = await ctx.auth.getUserIdentity();
            logCreateClientSecretTrace(traceId, "identity_loaded", {
                hasIdentity: !!identity,
                userId: identity?.subject,
            });
            if (!identity)
                throw new Error("Unauthenticated");
            const [membership, app] = await Promise.all([
                ctx.runQuery(api_1.api.org.getMyMembership),
                ctx.runQuery(api_1.api.console.getApp, { appId: args.appId }),
            ]);
            logCreateClientSecretTrace(traceId, "convex_queries_completed", {
                hasMembership: !!membership,
                membershipRole: membership?.role,
                membershipOrgId: membership?.orgId,
                hasApp: !!app,
                appOrgId: app?.orgId,
                workosAppId: app?.workosAppId,
                workosClientId: app?.workosClientId,
            });
            if (!membership)
                throw new Error("User does not belong to any organisation");
            if (membership.role !== "admin")
                throw new Error("Only admins can create secrets");
            if (!app)
                throw new Error("App not found");
            if (app.orgId !== membership.orgId)
                throw new Error("Unauthorized");
            logCreateClientSecretTrace(traceId, "workos_request_prepared", {
                method: "POST",
                path: `/connect/applications/${app.workosAppId}/client_secrets`,
                hasBody: false,
                headers: ["Authorization"],
            });
            const secret = await workosRequest(`/connect/applications/${app.workosAppId}/client_secrets`, { method: "POST" });
            logCreateClientSecretTrace(traceId, "workos_response_received", {
                object: secret.object,
                secretId: secret.id,
                secretHint: secret.secret_hint,
                hasSecret: typeof secret.secret === "string",
                secretLength: typeof secret.secret === "string" ? secret.secret.length : undefined,
                lastUsedAt: secret.last_used_at ?? null,
                createdAt: secret.created_at,
                updatedAt: secret.updated_at ?? null,
            });
            if (!secret.secret) {
                debugClientSecretsLog("create_missing_secret_body", {
                    durationMs: Date.now() - t0,
                    workosReturnedId: shortId(secret.id),
                });
                throw new values_1.ConvexError({
                    code: "MISSING_SECRET",
                    message: "WorkOS did not return the secret value",
                });
            }
            const responsePayload = {
                traceId,
                secretId: secret.id,
                secret: secret.secret,
                lastFour: getClientSecretLastFour(secret),
                name: getClientSecretLabel(secret, args.name),
                createdAt: secret.created_at ?? new Date().toISOString(),
            };
            logCreateClientSecretTrace(traceId, "response_ready_for_frontend", {
                secretId: responsePayload.secretId,
                name: responsePayload.name,
                lastFour: responsePayload.lastFour,
                createdAt: responsePayload.createdAt,
                hasSecret: true,
                secretLength: responsePayload.secret.length,
            });
            logCreateClientSecretTrace(traceId, "database_write_skipped", {
                reason: "Client secrets are not stored in Convex. WorkOS returns the plaintext secret once and the frontend keeps it in memory only.",
            });
            debugClientSecretsLog("create_ok", {
                secretId: shortId(secret.id),
                lastFour: getClientSecretLastFour(secret),
                hasSecretValue: true,
                durationMs: Date.now() - t0,
            });
            logCreateClientSecretTrace(traceId, "returning_to_frontend", {
                durationMs: Date.now() - t0,
            });
            return responsePayload;
        }
        catch (e) {
            logCreateClientSecretTrace(traceId, "request_failed", {
                durationMs: Date.now() - t0,
                error: e instanceof Error
                    ? { name: e.name, message: e.message, stack: e.stack }
                    : String(e),
            });
            debugClientSecretsLog("create_fail", {
                message: e instanceof Error ? e.message : String(e),
                durationMs: Date.now() - t0,
            });
            throw e;
        }
        finally {
            debugLockLeave(lockKey);
        }
    },
});
/** List client secrets for an app (metadata only, no secret values). */
exports.listClientSecrets = (0, server_1.action)({
    args: { appId: values_1.v.id("consoleApp") },
    handler: async (ctx, args) => {
        const t0 = Date.now();
        const lockKey = `list:${args.appId}`;
        debugLockEnter(lockKey, "list");
        try {
            debugClientSecretsLog("list_start", {
                appId: shortId(String(args.appId)),
            });
            const identity = await ctx.auth.getUserIdentity();
            if (!identity)
                throw new Error("Unauthenticated");
            const [membership, app] = await Promise.all([
                ctx.runQuery(api_1.api.org.getMyMembership),
                ctx.runQuery(api_1.api.console.getApp, { appId: args.appId }),
            ]);
            if (!membership)
                throw new Error("User does not belong to any organisation");
            if (!app)
                throw new Error("App not found");
            if (app.orgId !== membership.orgId)
                throw new Error("Unauthorized");
            debugClientSecretsLog("list_auth_ok", {
                workosAppId: shortId(app.workosAppId),
            });
            const result = await workosRequest(`/connect/applications/${app.workosAppId}/client_secrets`);
            const shape = result === null || result === undefined
                ? "null"
                : Array.isArray(result)
                    ? "array"
                    : typeof result === "object"
                        ? `keys:${Object.keys(result)
                            .sort()
                            .join(",")}`
                        : typeof result;
            const secrets = parseWorkOSClientSecretList(result);
            debugClientSecretsLog("list_parse", {
                responseShape: shape,
                parsedCount: secrets.length,
            });
            const rows = secrets
                .filter((s) => typeof s.id === "string" && s.id.length > 0)
                .map((s) => ({
                id: s.id,
                name: getClientSecretLabel(s, ""),
                lastFour: getClientSecretLastFour(s),
                createdAt: s.created_at ?? "",
            }));
            debugClientSecretsLog("list_ok", {
                rowCount: rows.length,
                durationMs: Date.now() - t0,
            });
            return rows;
        }
        catch (e) {
            debugClientSecretsLog("list_fail", {
                message: e instanceof Error ? e.message : String(e),
                durationMs: Date.now() - t0,
            });
            throw e;
        }
        finally {
            debugLockLeave(lockKey);
        }
    },
});
/** Revoke (delete) a client secret by its WorkOS secret ID. */
exports.revokeClientSecret = (0, server_1.action)({
    args: {
        appId: values_1.v.id("consoleApp"),
        secretId: values_1.v.string(),
    },
    handler: async (ctx, args) => {
        const t0 = Date.now();
        const lockKey = `revoke:${args.appId}:${args.secretId}`;
        debugLockEnter(lockKey, "revoke");
        try {
            debugClientSecretsLog("revoke_start", {
                appId: shortId(String(args.appId)),
                secretId: shortId(args.secretId),
            });
            const identity = await ctx.auth.getUserIdentity();
            if (!identity)
                throw new Error("Unauthenticated");
            const [membership, app] = await Promise.all([
                ctx.runQuery(api_1.api.org.getMyMembership),
                ctx.runQuery(api_1.api.console.getApp, { appId: args.appId }),
            ]);
            if (!membership)
                throw new Error("User does not belong to any organisation");
            if (membership.role !== "admin")
                throw new Error("Only admins can revoke secrets");
            if (!app)
                throw new Error("App not found");
            if (app.orgId !== membership.orgId)
                throw new Error("Unauthorized");
            await workosRequest(`/connect/client_secrets/${args.secretId}`, {
                method: "DELETE",
            });
            debugClientSecretsLog("revoke_ok", { durationMs: Date.now() - t0 });
        }
        catch (e) {
            debugClientSecretsLog("revoke_fail", {
                message: e instanceof Error ? e.message : String(e),
                durationMs: Date.now() - t0,
            });
            throw e;
        }
        finally {
            debugLockLeave(lockKey);
        }
    },
});
// ---------------------------------------------------------------------------
// Helper query — org record for actions (direct DB access within this module)
// ---------------------------------------------------------------------------
exports.getOrgRecord = (0, server_1.query)({
    args: { orgId: values_1.v.id("organisation") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity)
            throw new Error("Unauthenticated");
        const org = await ctx.db.get(args.orgId);
        if (!org)
            return null;
        return {
            _id: org._id,
            name: org.name,
            workosOrgId: org.workosOrgId,
        };
    },
});
//# sourceMappingURL=console.js.map