// Vault recovery in the vault app (see crypto/companyRecovery and the server's
// CompanyRecoveryService / VaultRecoveryService): turning it on, the background
// work after the vault opens, and completing an approved recovery request.
import { fetcherGet, fetcherPost } from "../configs/axios";
import axios from "../configs/axios";
import {
  newRecoveryPair,
  openRecoveryKey,
  openVaultKeyFromRecovery,
  sealRecoveryKey,
  sealVaultKeyForRecovery,
  vaultKeyOpens,
} from "../crypto/companyRecovery";
import { eachSafely } from "./eachSafely";
import { sealCollectionKey } from "../crypto/items";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";
import { collectionKeyFor } from "./vaultItems";

export interface RecoveryPerson {
  userId: number;
  email: string;
}

export interface RecoveryStatus {
  enabled: boolean;
  /** Hours between approval and when a recovery can run (0, 24, 48 or 72). */
  waitHours: number;
  custodians: RecoveryPerson[];
  iAmCustodian: boolean;
  /** This person holds the current recovery key copy (can complete requests). */
  holdsKey: boolean;
  /** No active custodian holds the key: nobody can recover until the owner turns it off and on again. */
  keyLost: boolean;
  /** Vaults a request can recover now (a usable recovery copy exists). */
  recoverableVaultIds: number[];
  /** Named custodians who are no longer owners/admins; dropped at the next key replacement. */
  inactiveCustodians: RecoveryPerson[];
  /** For the owner: owners and admins with end-to-end on, who can be custodians. */
  candidates?: (RecoveryPerson & { publicKey: string })[];
}

export const WAIT_CHOICES = [0, 24, 48, 72] as const;

interface Custodian {
  userId: number;
  publicKey: string;
}

const openKeys = () => {
  const keys = useKeyStore.getState().keys;
  if (!keys) throw new Error("Unlock your vault first.");
  return keys;
};

const myId = () => Number(useAuthStore.getState().me?.id);

const sealToCustodians = (custodians: Custodian[], companyId: number, keyVersion: number, privateKey: Uint8Array) =>
  Promise.all(
    custodians.map(async (custodian) => ({
      userId: custodian.userId,
      wrappedKey: await sealRecoveryKey(custodian.publicKey, companyId, keyVersion, privateKey),
    }))
  );

export const recoveryStatus = (companyId: number): Promise<RecoveryStatus> =>
  fetcherGet(`/api/companies/${companyId}/recovery`);

/**
 * The owner turns it on: a new key pair, its private key sealed to the owner
 * and the other custodians they named (owners or admins with end-to-end on).
 */
export const enableRecovery = async (companyId: number, otherCustodianIds: number[], waitHours: number) => {
  openKeys();
  const status = await recoveryStatus(companyId);
  const candidates = status.candidates || [];
  const custodians = candidates.filter((item) => item.userId === myId() || otherCustodianIds.includes(item.userId));
  if (!custodians.some((item) => item.userId === myId())) {
    throw new Error("Turn on end-to-end encryption for your own account first.");
  }
  const pair = await newRecoveryPair();
  await fetcherPost(`/api/companies/${companyId}/recovery/enable`, {
    publicKey: pair.publicKey,
    waitHours,
    custodianIds: custodians.map((item) => item.userId),
    keys: await sealToCustodians(custodians, companyId, 1, pair.privateKey),
  });
  // The vaults this browser can open get their recovery copies right away.
  await runRecoveryTasks();
};

export const disableRecovery = (companyId: number) => fetcherPost(`/api/companies/${companyId}/recovery/disable`, {});

/** The owner changes the waiting period or the custodians (new ones get the key from a custodian's browser). */
export const updateRecoverySettings = async (companyId: number, settings: { waitHours?: number; custodianIds?: number[] }) => {
  await axios.put(`/api/companies/${companyId}/recovery/settings`, settings);
  await runRecoveryTasks().catch(() => undefined);
};

let running: Promise<void> | null = null;

/**
 * After the vault opens (and every so often): as a custodian, give the
 * recovery key to custodians without one, or replace it after someone left;
 * as a holder of a company vault's key, seal it to the recovery key when its
 * recovery copy is missing or out of date.
 */
export const runRecoveryTasks = () => {
  if (!running) {
    running = (async () => {
      const keys = useKeyStore.getState().keys;
      if (!keys || !useAuthStore.getState().me?.e2eEnabled) return;
      const { grant = [], rotate = [], continuity = [] } = await fetcherGet("/api/companies/recovery/tasks");
      // Each task on its own: one company's failure (a race, a 409) doesn't hold up the rest.
      const failures = await eachSafely(grant, async (task: any) => {
        const privateKey = await openRecoveryKey(keys.privateKey, keys.publicKey, task.companyId, task.keyVersion, task.myKey);
        await fetcherPost("/api/companies/recovery/grant", {
          companyId: task.companyId,
          keyVersion: task.keyVersion,
          keys: await sealToCustodians(task.custodians, task.companyId, task.keyVersion, privateKey),
        });
      });
      const rotateFailures = await eachSafely(rotate, async (task: any) => {
        const pair = await newRecoveryPair();
        await fetcherPost("/api/companies/recovery/rotate", {
          companyId: task.companyId,
          keyVersion: task.keyVersion + 1,
          publicKey: pair.publicKey,
          keys: await sealToCustodians(task.custodians, task.companyId, task.keyVersion + 1, pair.privateKey),
        });
      });
      [...failures, ...rotateFailures].forEach(({ error }) =>
        console.error("Recovery task failed:", (error as Error)?.message || error)
      );
      // A replaced recovery key: the vault copies are made again for the new one, in the next pass.
      if (rotate.length > rotateFailures.length) {
        running = null;
        await runRecoveryTasks();
        return;
      }
      const items = [];
      for (const task of continuity) {
        try {
          const vaultKey = await collectionKeyFor(task.collectionId, task.keyVersion, task.myKey);
          items.push({
            collectionId: task.collectionId,
            keyVersion: task.keyVersion,
            recoveryKeyVersion: task.recoveryKeyVersion,
            wrappedKey: await sealVaultKeyForRecovery(
              task.recoveryPublicKey,
              task.companyId,
              task.recoveryKeyVersion,
              task.collectionId,
              task.keyVersion,
              vaultKey
            ),
          });
        } catch {
          /* Not openable here; another key holder does it. */
        }
      }
      if (items.length) await fetcherPost("/api/companies/recovery/continuity", { items });
    })().finally(() => {
      running = null;
    });
  }
  return running;
};

/**
 * A custodian completes an approved, ready recovery request: their copy of the
 * recovery key opens the vault's recovery copy here, and the vault key is
 * sealed to the person who gets access. The server never sees the key.
 */
export const completeRecoveryRequest = async (companyId: number, requestId: number) => {
  const keys = openKeys();
  const base = `/api/companies/${companyId}/recovery/requests/${requestId}`;
  const material = await fetcherGet(`${base}/material`);
  const recoveryKey = await openRecoveryKey(keys.privateKey, keys.publicKey, companyId, material.recoveryKeyVersion, material.myKey);
  const vaultKey = await openVaultKeyFromRecovery(
    recoveryKey,
    material.recoveryPublicKey,
    companyId,
    material.recoveryKeyVersion,
    material.vault.collectionId,
    material.vault.keyVersion,
    material.vault.wrappedKey
  );
  // A damaged or wrongly saved copy opens to some other key: never hand that to anyone.
  if (!(await vaultKeyOpens(vaultKey, material.vault.collectionId, material.check ?? null))) {
    // Exactly the copy that was checked (one re-made meanwhile stays).
    await axios.delete(`${base}/copy`, { params: { copyId: material.copyId } }).catch(() => undefined);
    throw new Error("This vault's recovery copy is damaged. A key holder must open 2keevo to make a new one.");
  }
  await fetcherPost(`${base}/complete`, {
    keyVersion: material.vault.keyVersion,
    granteePublicKey: material.grantee.publicKey,
    wrappedKey: await sealCollectionKey(material.grantee.publicKey, material.vault.collectionId, material.vault.keyVersion, vaultKey),
  });
};
