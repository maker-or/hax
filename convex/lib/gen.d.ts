/** Byte lengths passed to `randomString` for API key segments (must stay in sync with parsing). */
export declare const API_KEY_PUBLIC_ID_BYTES = 6;
export declare const API_KEY_SECRET_BYTES = 24;
/**
 * Parse `sk_live_{publicId}_{secret}`. Uses fixed segment lengths so `_` inside
 * base64url segments does not break parsing.
 */
export declare function parseApiKeyToken(rawToken: string): {
    publicId: string;
    secret: string;
} | null;
export declare function createApiKey(): Promise<{
    key: string;
    publicId: string;
    secret: string;
    hashsecret: string;
}>;
export declare function checkapiKey(storedHash: string, rawSecret: string): Promise<boolean>;
//# sourceMappingURL=gen.d.ts.map