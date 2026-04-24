const KEY_PROMISE: Promise<CryptoKey> = (async () => {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("myos-credential-store-v1"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
})();

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await KEY_PROMISE;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), iv.byteLength);
  return toBase64(out);
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await KEY_PROMISE;
  const data = fromBase64(ciphertext);
  const iv = data.slice(0, 12);
  const encrypted = data.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(plaintext);
}
