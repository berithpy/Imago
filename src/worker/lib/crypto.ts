/**
 * PBKDF2 password hashing using Web Crypto API (native in CF Workers).
 * Uses PBKDF2-HMAC-SHA256 with 100,000 iterations — OWASP-compliant
 * and within Workers CPU time limits on paid plan.
 * Stores as: "iterations:base64(salt):base64(hash)"
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 16; // 128 bits
const HASH_ALGO = "SHA-256";

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: HASH_ALGO,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function pbkdf2Hash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt, ITERATIONS);
  return `${ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function pbkdf2Verify(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3) return false;

  const [iterStr, saltB64, hashB64] = parts;
  const iterations = parseInt(iterStr, 10);
  if (isNaN(iterations)) return false;

  const salt = fromBase64(saltB64);
  const expectedHash = fromBase64(hashB64);
  const actualHash = new Uint8Array(await deriveKey(password, salt, iterations));

  // Constant-time comparison
  if (actualHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actualHash.length; i++) {
    diff |= actualHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}
