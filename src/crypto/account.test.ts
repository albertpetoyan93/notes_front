import { describe, expect, it } from "vitest";
import {
  createAccountKeys,
  openBundle,
  openBundleWithUserKey,
  openUserKeyWithPasskey,
  openWithRecovery,
  recoveryProof,
  relockForPassword,
  replaceRecovery,
  signInKeys,
  wrapUserKeyForPasskey,
  type KeyBundle,
} from "./account";
import { DEFAULT_KDF, E2EError, randomBytes } from "./e2e";

// Lower Argon2 settings keep the tests quick; the real default is tested in e2e.test.ts.
const FAST = { ...DEFAULT_KDF, memory: 32 * 1024, iterations: 2 };
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

const bundleOf = (request: Awaited<ReturnType<typeof createAccountKeys>>["request"]): KeyBundle => ({
  kdf: request.kdf,
  protectedUserKey: request.protectedUserKey,
  publicKey: request.publicKey,
  protectedPrivateKey: request.protectedPrivateKey,
});

describe("master-password account", () => {
  it("signs in and opens the vault with only the password and the stored values", async () => {
    const { request, unlocked, recoveryKey } = await createAccountKeys("a good master password", FAST);
    expect(recoveryKey).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
    // What the server stores never contains the password or an open key.
    const stored = JSON.stringify(request);
    expect(stored).not.toContain("a good master password");
    expect(stored).not.toContain(Buffer.from(unlocked.userKey).toString("base64url"));

    const again = await signInKeys("a good master password", request.kdf);
    expect(again.authKey).toBe(request.authKey);
    const opened = await openBundle(again.masterKey, bundleOf(request));
    expect(hex(opened.userKey)).toBe(hex(unlocked.userKey));
    expect(hex(opened.privateKey)).toBe(hex(unlocked.privateKey));
  }, 60000);

  it("a wrong password gives another sign-in key and opens nothing", async () => {
    const { request } = await createAccountKeys("a good master password", FAST);
    const wrong = await signInKeys("a good master passw0rd", request.kdf);
    expect(wrong.authKey).not.toBe(request.authKey);
    await expect(openBundle(wrong.masterKey, bundleOf(request))).rejects.toBeInstanceOf(E2EError);
  }, 60000);

  it("changing the master password keeps the same vault key", async () => {
    const { request, unlocked } = await createAccountKeys("old master password", FAST);
    const change = await relockForPassword("new master password", unlocked.userKey, FAST);
    const signIn = await signInKeys("new master password", change.kdf);
    expect(signIn.authKey).toBe(change.authKey);
    const opened = await openBundle(signIn.masterKey, { ...bundleOf(request), ...change });
    expect(hex(opened.userKey)).toBe(hex(unlocked.userKey));
  }, 60000);

  it("the recovery key opens the vault key; a new one replaces it", async () => {
    const { request, unlocked, recoveryKey } = await createAccountKeys("master", FAST);
    expect(await recoveryProof(recoveryKey)).toBe(request.recoveryAuth);
    // Typed in lower case with spaces still works.
    const typed = recoveryKey.toLowerCase().replace(/-/g, " ");
    expect(hex(await openWithRecovery(typed, request.recoveryProtectedUserKey))).toBe(hex(unlocked.userKey));

    const fresh = await replaceRecovery(unlocked.userKey);
    expect(fresh.recoveryKey).not.toBe(recoveryKey);
    await expect(openWithRecovery(recoveryKey, fresh.recoveryProtectedUserKey)).rejects.toBeInstanceOf(E2EError);
    expect(hex(await openWithRecovery(fresh.recoveryKey, fresh.recoveryProtectedUserKey))).toBe(hex(unlocked.userKey));
  }, 60000);

  it("a passkey's PRF secret opens a copy of the vault key, and only that secret", async () => {
    const { request, unlocked } = await createAccountKeys("master", FAST);
    const prf = randomBytes(32);
    const token = await wrapUserKeyForPasskey(prf, unlocked.userKey);
    const userKey = await openUserKeyWithPasskey(prf, token);
    const opened = await openBundleWithUserKey(userKey, bundleOf(request));
    expect(hex(opened.privateKey)).toBe(hex(unlocked.privateKey));
    await expect(openUserKeyWithPasskey(randomBytes(32), token)).rejects.toBeInstanceOf(E2EError);
    // Too short to be a PRF result.
    await expect(openUserKeyWithPasskey(randomBytes(16), token)).rejects.toBeInstanceOf(E2EError);
  }, 60000);
});
