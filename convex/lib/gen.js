"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_KEY_SECRET_BYTES = exports.API_KEY_PUBLIC_ID_BYTES = void 0;
exports.parseApiKeyToken = parseApiKeyToken;
exports.createApiKey = createApiKey;
exports.checkapiKey = checkapiKey;
function randomString(bytes) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    const base64 = btoa(String.fromCharCode(...Array.from(arr)));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
/** Byte lengths passed to `randomString` for API key segments (must stay in sync with parsing). */
exports.API_KEY_PUBLIC_ID_BYTES = 6;
exports.API_KEY_SECRET_BYTES = 24;
/** Character length of unpadded base64 (matches `randomString`). */
function base64UrlUnpaddedCharLength(bytes) {
    return Math.ceil((bytes * 4) / 3);
}
/**
 * Parse `sk_live_{publicId}_{secret}`. Uses fixed segment lengths so `_` inside
 * base64url segments does not break parsing.
 */
function parseApiKeyToken(rawToken) {
    const prefix = "sk_live_";
    if (!rawToken.startsWith(prefix))
        return null;
    const afterPrefix = rawToken.slice(prefix.length);
    const publicLen = base64UrlUnpaddedCharLength(exports.API_KEY_PUBLIC_ID_BYTES);
    const secretLen = base64UrlUnpaddedCharLength(exports.API_KEY_SECRET_BYTES);
    if (afterPrefix.length !== publicLen + 1 + secretLen)
        return null;
    if (afterPrefix[publicLen] !== "_")
        return null;
    return {
        publicId: afterPrefix.slice(0, publicLen),
        secret: afterPrefix.slice(publicLen + 1),
    };
}
async function sha256Hex(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function createApiKey() {
    const publicId = randomString(exports.API_KEY_PUBLIC_ID_BYTES);
    const secret = randomString(exports.API_KEY_SECRET_BYTES);
    const hashsecret = await sha256Hex(secret);
    return {
        key: `sk_live_${publicId}_${secret}`,
        publicId,
        secret,
        hashsecret,
    };
}
async function checkapiKey(storedHash, rawSecret) {
    const computed = await sha256Hex(rawSecret);
    return computed === storedHash;
}
//# sourceMappingURL=gen.js.map