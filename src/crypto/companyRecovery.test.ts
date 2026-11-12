import { describe, expect, it } from "vitest";
import * as recovery from "./companyRecovery";
import {
  newRecoveryPair,
  openRecoveryKey,
  openVaultKeyFromRecovery,
  sealRecoveryKey,
  sealVaultKeyForRecovery,
  vaultKeyOpens,
} from "./companyRecovery";
import { E2EError, generateKeyPair } from "./e2e";
import { newCollectionKey, sealCollectionName, wrapForCollection } from "./items";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

describe("vault recovery", () => {
  it("a custodian opens a vault's recovery copy with their copy of the recovery key", async () => {
    const custodian = await generateKeyPair();
    const pair = await newRecoveryPair();
    const vaultKey = newCollectionKey();
    const forCustodian = await sealRecoveryKey(custodian.publicKey, 4, 1, pair.privateKey);
    // Made in any key holder's browser: only the recovery public key is needed.
    const copy = await sealVaultKeyForRecovery(pair.publicKey, 4, 1, 40, 3, vaultKey);

    // In the custodian's browser.
    const recoveryKey = await openRecoveryKey(custodian.privateKey, custodian.publicKey, 4, 1, forCustodian);
    const opened = await openVaultKeyFromRecovery(recoveryKey, pair.publicKey, 4, 1, 40, 3, copy);
    expect(hex(opened)).toBe(hex(vaultKey));
  });

  it("a copy is bound to its company, recovery key version, vault and vault key version", async () => {
    const pair = await newRecoveryPair();
    const copy = await sealVaultKeyForRecovery(pair.publicKey, 4, 1, 40, 3, newCollectionKey());
    const open = (companyId: number, recoveryVersion: number, collectionId: number, keyVersion: number) =>
      openVaultKeyFromRecovery(pair.privateKey, pair.publicKey, companyId, recoveryVersion, collectionId, keyVersion, copy);
    await expect(open(5, 1, 40, 3)).rejects.toBeInstanceOf(E2EError);
    await expect(open(4, 2, 40, 3)).rejects.toBeInstanceOf(E2EError);
    await expect(open(4, 1, 41, 3)).rejects.toBeInstanceOf(E2EError);
    await expect(open(4, 1, 40, 2)).rejects.toBeInstanceOf(E2EError);
  });

  it("recovery key copies are bound to their company and version", async () => {
    const custodian = await generateKeyPair();
    const other = await generateKeyPair();
    const pair = await newRecoveryPair();
    const forCustodian = await sealRecoveryKey(custodian.publicKey, 4, 1, pair.privateKey);
    await expect(openRecoveryKey(other.privateKey, other.publicKey, 4, 1, forCustodian)).rejects.toBeInstanceOf(E2EError);
    await expect(openRecoveryKey(custodian.privateKey, custodian.publicKey, 5, 1, forCustodian)).rejects.toBeInstanceOf(E2EError);
    await expect(openRecoveryKey(custodian.privateKey, custodian.publicKey, 4, 2, forCustodian)).rejects.toBeInstanceOf(E2EError);
  });

  it("tells a vault key that opens the vault from one that doesn't (a damaged recovery copy)", async () => {
    const vaultKey = newCollectionKey();
    const otherKey = newCollectionKey();
    const encName = await sealCollectionName(vaultKey, 40, "v3", "Servers");
    const itemCheck = { kind: "item" as const, e2eId: "e2e-81", wrappedKey: await wrapForCollection(vaultKey, 40, "e2e-81", newCollectionKey()) };
    const nameCheck = { kind: "name" as const, encName, nameKey: "v3" };
    expect(await vaultKeyOpens(vaultKey, 40, nameCheck)).toBe(true);
    expect(await vaultKeyOpens(vaultKey, 40, itemCheck)).toBe(true);
    expect(await vaultKeyOpens(otherKey, 40, nameCheck)).toBe(false);
    expect(await vaultKeyOpens(otherKey, 40, itemCheck)).toBe(false);
    // Nothing to check against (an empty vault with a readable name): accepted.
    expect(await vaultKeyOpens(otherKey, 40, null)).toBe(true);
  });

  it("can no longer seal a member's user key to the company", () => {
    expect((recovery as Record<string, unknown>).sealUserKeyForCompany).toBeUndefined();
    expect((recovery as Record<string, unknown>).openMemberUserKey).toBeUndefined();
  });
});
