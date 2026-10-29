// Company admin recovery in the vault app (see crypto/companyRecovery and the
// server's CompanyRecoveryService): turning it on, the background work after
// the vault opens, and resetting a member's master password.
import { fetcherGet, fetcherPost } from "../configs/axios";
import { relockForPassword } from "../crypto/account";
import {
  newRecoveryPair,
  openMemberUserKey,
  openRecoveryKey,
  sealRecoveryKey,
  sealUserKeyForCompany,
} from "../crypto/companyRecovery";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";

export interface RecoveryStatus {
  enabled: boolean;
  enrolledMe: boolean;
  recoverable?: number[];
  canRecover?: boolean;
  managers?: { userId: number; publicKey: string | null }[];
}

interface Manager {
  userId: number;
  publicKey: string;
}

const openKeys = () => {
  const keys = useKeyStore.getState().keys;
  if (!keys) throw new Error("Unlock your vault first.");
  return keys;
};

const myId = () => Number(useAuthStore.getState().me?.id);

const sealToManagers = (managers: Manager[], companyId: number, keyVersion: number, privateKey: Uint8Array) =>
  Promise.all(
    managers.map(async (manager) => ({
      userId: manager.userId,
      wrappedKey: await sealRecoveryKey(manager.publicKey, companyId, keyVersion, privateKey),
    }))
  );

export const recoveryStatus = (companyId: number): Promise<RecoveryStatus> =>
  fetcherGet(`/api/companies/${companyId}/recovery`);

/**
 * The owner turns it on: a new key pair, its private key sealed to every
 * owner and admin who has end-to-end encryption on. Others get it later.
 */
export const enableRecovery = async (companyId: number) => {
  openKeys();
  const status = await recoveryStatus(companyId);
  const managers = (status.managers || []).filter((item): item is Manager => !!item.publicKey);
  if (!managers.some((item) => item.userId === myId())) {
    throw new Error("Turn on end-to-end encryption for your own account first.");
  }
  const pair = await newRecoveryPair();
  await fetcherPost(`/api/companies/${companyId}/recovery/enable`, {
    publicKey: pair.publicKey,
    keys: await sealToManagers(managers, companyId, 1, pair.privateKey),
  });
  // Seal the owner's own user key right away, like every member's browser will.
  await runRecoveryTasks();
};

export const disableRecovery = (companyId: number) => fetcherPost(`/api/companies/${companyId}/recovery/disable`, {});

let running: Promise<void> | null = null;

/**
 * After the vault opens: seal this person's user key for each company with
 * admin recovery on; as an owner or admin, give the recovery key to new
 * owners and admins, or replace it after someone who held it left that role.
 */
export const runRecoveryTasks = () => {
  if (!running) {
    running = (async () => {
      const keys = useKeyStore.getState().keys;
      if (!keys || !useAuthStore.getState().me?.e2eEnabled) return;
      const { enroll = [], grant = [], rotate = [] } = await fetcherGet("/api/companies/recovery/tasks");
      for (const task of enroll) {
        await fetcherPost("/api/companies/recovery/enroll", {
          companyId: task.companyId,
          keyVersion: task.keyVersion,
          sealedUserKey: await sealUserKeyForCompany(task.publicKey, task.companyId, task.keyVersion, myId(), keys.userKey),
        });
      }
      for (const task of grant) {
        const privateKey = await openRecoveryKey(keys.privateKey, keys.publicKey, task.companyId, task.keyVersion, task.myKey);
        await fetcherPost("/api/companies/recovery/grant", {
          companyId: task.companyId,
          keyVersion: task.keyVersion,
          keys: await sealToManagers(task.managers, task.companyId, task.keyVersion, privateKey),
        });
      }
      for (const task of rotate) {
        const pair = await newRecoveryPair();
        await fetcherPost("/api/companies/recovery/rotate", {
          companyId: task.companyId,
          keyVersion: task.keyVersion + 1,
          publicKey: pair.publicKey,
          keys: await sealToManagers(task.managers, task.companyId, task.keyVersion + 1, pair.privateKey),
        });
      }
      // Rotated: this person's own copy is sealed again to the new key.
      if (rotate.length) {
        running = null;
        await runRecoveryTasks();
      }
    })().finally(() => {
      running = null;
    });
  }
  return running;
};

/**
 * Reset a member's master password: open their user key here (with this
 * owner's or admin's copy of the recovery key) and lock it with a temporary
 * master password, which the admin gives them.
 */
export const resetMemberPassword = async (companyId: number, memberUserId: number, temporaryPassword: string) => {
  const keys = openKeys();
  const data = await fetcherGet(`/api/companies/${companyId}/recovery/members/${memberUserId}`);
  const recoveryKey = await openRecoveryKey(keys.privateKey, keys.publicKey, companyId, data.keyVersion, data.myKey);
  const userKey = await openMemberUserKey(recoveryKey, data.publicKey, companyId, data.keyVersion, memberUserId, data.sealedUserKey);
  await fetcherPost(
    `/api/companies/${companyId}/recovery/members/${memberUserId}`,
    await relockForPassword(temporaryPassword, userKey)
  );
};
