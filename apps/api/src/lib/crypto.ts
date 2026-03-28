import crypto from "node:crypto";

interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

function toKey(keyMaterial: string): Buffer {
  return crypto.createHash("sha256").update(keyMaterial, "utf8").digest();
}

export function encryptJson(value: unknown, keyMaterial: string): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const key = toKey(keyMaterial);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

export function decryptJson<T>(payload: unknown, keyMaterial: string): T {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid encrypted payload");
  }

  const typed = payload as Partial<EncryptedPayload>;
  if (typeof typed.iv !== "string" || typeof typed.tag !== "string" || typeof typed.data !== "string") {
    throw new Error("Invalid encrypted payload");
  }

  const iv = Buffer.from(typed.iv, "base64");
  const tag = Buffer.from(typed.tag, "base64");
  const encrypted = Buffer.from(typed.data, "base64");
  const key = toKey(keyMaterial);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
