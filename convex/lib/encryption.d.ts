/**
 * AES-GCM encryption/decryption helpers using the Web Crypto API (crypto.subtle).
 *
 * Requires the environment variable ENCRYPTION_KEY to be set as a
 * Base64-encoded 32-byte (256-bit) key.
 *
 * Generate one with:
 *   node -e "console.log(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'))"
 */
/**
 * Encrypts a plain-text string.
 * Returns a Base64-encoded string in the format: <iv>:<ciphertext>
 */
export declare function encrypt(plaintext: string): Promise<string>;
/**
 * Decrypts a Base64-encoded string produced by `encrypt`.
 * Expects the format: <iv>:<ciphertext>
 */
export declare function decrypt(encryptedValue: string): Promise<string>;
//# sourceMappingURL=encryption.d.ts.map