// Vault recovery (ADR-001 option A): the company's recovery key pair, its
// private key sealed to each custodian, and each company vault (collection) key
// sealed to its public key. Members' user keys are never sealed to the company,
// so recovery can't open anyone's personal items. Every copy is bound to its
// company and key versions (and, for vault copies, the vault).
import { E2EError, generateKeyPair, openSealed, sealTo } from "./e2e";
import { openCollectionName, openFromCollection } from "./items";

/** What the server sends with recovery material to check an opened vault key against. */
export type VaultKeyCheck =
  | { kind: "name"; encName: string; nameKey: string }
  | { kind: "item"; e2eId: string; wrappedKey: string }
  | null;

/**
 * Does this key really open the vault (its encrypted name, or one item key)?
 * A damaged or wrongly saved recovery copy opens to some other key: it must
 * not be handed to anyone. With nothing to check against, the key is accepted.
 */
export const vaultKeyOpens = async (vaultKey: Uint8Array, collectionId: number, check: VaultKeyCheck) => {
  if (!check) return true;
  try {
    if (check.kind === "name") await openCollectionName(vaultKey, collectionId, check.nameKey, check.encName);
    else await openFromCollection(vaultKey, collectionId, check.e2eId, check.wrappedKey);
    return true;
  } catch {
    return false;
  }
};

const custodianContext = (companyId: number, keyVersion: number) => `company-recovery:${companyId}:${keyVersion}`;
const vaultContext = (companyId: number, recoveryKeyVersion: number, collectionId: number, keyVersion: number) =>
  `company-vault:${companyId}:${recoveryKeyVersion}:${collectionId}:${keyVersion}`;

/** A new recovery key pair (when turning it on, or replacing it). */
export const newRecoveryPair = () => generateKeyPair();

/** The recovery private key for one custodian. */
export const sealRecoveryKey = (custodianPublicKey: string, companyId: number, keyVersion: number, privateKey: Uint8Array) =>
  sealTo(custodianPublicKey, privateKey, custodianContext(companyId, keyVersion));

export const openRecoveryKey = (
  myPrivateKey: Uint8Array,
  myPublicKey: string,
  companyId: number,
  keyVersion: number,
  token: string
) => openSealed(myPrivateKey, myPublicKey, token, custodianContext(companyId, keyVersion));

/** A vault's key, sealed to the company recovery key (any holder of the vault key can make it). */
export const sealVaultKeyForRecovery = (
  recoveryPublicKey: string,
  companyId: number,
  recoveryKeyVersion: number,
  collectionId: number,
  keyVersion: number,
  collectionKey: Uint8Array
) => sealTo(recoveryPublicKey, collectionKey, vaultContext(companyId, recoveryKeyVersion, collectionId, keyVersion));

/** In a custodian's browser, for an approved recovery request. */
export const openVaultKeyFromRecovery = async (
  recoveryPrivateKey: Uint8Array,
  recoveryPublicKey: string,
  companyId: number,
  recoveryKeyVersion: number,
  collectionId: number,
  keyVersion: number,
  token: string
) => {
  const key = await openSealed(
    recoveryPrivateKey,
    recoveryPublicKey,
    token,
    vaultContext(companyId, recoveryKeyVersion, collectionId, keyVersion)
  );
  if (key.length !== 32) throw new E2EError("bad-key");
  return key;
};
