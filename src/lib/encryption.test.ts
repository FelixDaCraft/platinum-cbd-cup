import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  encryptJson,
  decryptJson,
  generateEncryptionKey,
  isEncryptionConfigured,
} from "./encryption";

// Store original env
const originalEnv = process.env.ENCRYPTION_KEY;

describe("Encryption Utility", () => {
  beforeEach(() => {
    // Set a valid 64-character hex key (32 bytes)
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe("generateEncryptionKey", () => {
    it("should generate a 64-character hex string", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it("should generate unique keys", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toEqual(key2);
    });
  });

  describe("isEncryptionConfigured", () => {
    it("should return true when ENCRYPTION_KEY is set correctly", () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("should return false when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it("should return false when ENCRYPTION_KEY has wrong length", () => {
      process.env.ENCRYPTION_KEY = "tooshort";
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt a simple string", () => {
      const plaintext = "Hello, World!";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt a JSON string", () => {
      const data = JSON.stringify({ apiKey: "sk_test_123", secret: "password" });
      const encrypted = encrypt(data);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(data);
    });

    it("should produce different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "test";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it("should produce ciphertext in correct format (iv:authTag:data)", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // 16 bytes IV = 32 hex chars
      expect(parts[1]).toHaveLength(32); // 16 bytes auth tag = 32 hex chars
    });

    it("should throw error when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY environment variable is not set");
    });

    it("should throw error for invalid encrypted data format", () => {
      expect(() => decrypt("invalid")).toThrow("Invalid encrypted data format");
    });

    it("should throw error for tampered data", () => {
      const encrypted = encrypt("test");
      // Tamper with the encrypted data
      const parts = encrypted.split(":");
      parts[2] = "00" + parts[2]!.slice(2); // Modify encrypted data
      const tampered = parts.join(":");
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("encryptJson/decryptJson", () => {
    it("should encrypt and decrypt a simple object", () => {
      const data = { name: "test", value: 123 };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it("should handle nested objects", () => {
      const data = {
        stripe: {
          secretKey: "sk_test_xxx",
          publishableKey: "pk_test_xxx",
        },
        settings: {
          enabled: true,
          threshold: 100,
        },
      };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it("should handle arrays", () => {
      const data = [1, 2, 3, { key: "value" }];
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });

    it("should handle special characters in strings", () => {
      const data = { message: "Hello! @#$%^&*() éàü 中文 🎉" };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson<typeof data>(encrypted);
      expect(decrypted).toEqual(data);
    });
  });
});
