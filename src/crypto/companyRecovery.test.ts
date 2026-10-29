import { describe, expect, it } from "vitest";
import { createAccountKeys, openBundle, relockForPassword, signInKeys } from "./account";
import {
  newRecoveryPair,
  openMemberUserKey,
  openRecoveryKey,
  sealRecoveryKey,
  sealUserKeyForCompany,
} from "./companyRecovery";
import { DEFAULT_KDF, E2EError, generateKeyPair } from "./e2e";

const FAST = { ...DEFAULT_KDF, memory: 32 * 1024, iterations: 2 };
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("company admin recovery", () => {
  it("an admin resets a member's master password; the vault opens with the new one", async () => {
    const admin = await generateKeyPair();
    const member = await createAccountKeys("member's forgotten password", FAST);
    const pair = await newRecoveryPair();
    const forAdmin = await sealRecoveryKey(admin.publicKey, 4, 1, pair.privateKey);
    const forCompany = await sealUserKeyForCompany(pair.publicKey, 4, 1, 77, member.unlocked.userKey);

    // In the admin's browser.
    const recoveryKey = await openRecoveryKey(admin.privateKey, admin.publicKey, 4, 1, forAdmin);
    const userKey = await openMemberUserKey(recoveryKey, pair.publicKey, 4, 1, 77, forCompany);
    const reset = await relockForPassword("a temporary master password", userKey, FAST);

    // The member signs in with it: same vault key, same private key.
    const signIn = await signInKeys("a temporary master password", reset.kdf);
    const opened = await openBundle(signIn.masterKey, {
      kdf: reset.kdf,
      protectedUserKey: reset.protectedUserKey,
      publicKey: member.request.publicKey,
      protectedPrivateKey: member.request.protectedPrivateKey,
    });
    expect(hex(opened.userKey)).toBe(hex(member.unlocked.userKey));
    expect(hex(opened.privateKey)).toBe(hex(member.unlocked.privateKey));
  }, 60000);

  it("copies are bound to their company, version and person", async () => {
    const admin = await generateKeyPair();
    const other = await generateKeyPair();
    const pair = await newRecoveryPair();
    const forAdmin = await sealRecoveryKey(admin.publicKey, 4, 1, pair.privateKey);
    await expect(openRecoveryKey(other.privateKey, other.publicKey, 4, 1, forAdmin)).rejects.toBeInstanceOf(E2EError);
    await expect(openRecoveryKey(admin.privateKey, admin.publicKey, 5, 1, forAdmin)).rejects.toBeInstanceOf(E2EError);
    await expect(openRecoveryKey(admin.privateKey, admin.publicKey, 4, 2, forAdmin)).rejects.toBeInstanceOf(E2EError);

    const userKey = new Uint8Array(32).fill(7);
    const forCompany = await sealUserKeyForCompany(pair.publicKey, 4, 1, 77, userKey);
    // Another member's copy can't be passed off as this one's.
    await expect(openMemberUserKey(pair.privateKey, pair.publicKey, 4, 1, 78, forCompany)).rejects.toBeInstanceOf(E2EError);
  });
});
