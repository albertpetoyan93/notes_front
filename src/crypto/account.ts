// Master-password accounts (E2E_DESIGN.md, stage 10.2), on top of the core.
// Each function returns exactly what the server stores or checks; the master
// password, the master key and the unlocked keys never leave this module's
// callers' memory.

import {
  DEFAULT_KDF,
  deriveAuthKey,
  deriveMasterKey,
  derivePasskeyWrappingKey,
  deriveRecoveryAuthKey,
  deriveRecoveryWrappingKey,
  deriveWrappingKey,
  fromB64url,
  generateKeyPair,
  newRecoveryKey,
  newSymmetricKey,
  randomBytes,
  toB64url,
  unwrapKey,
  wrapKey,
  type KdfParams,
} from "./e2e";

/** Argon2 settings as the server stores them, with the salt. */
export type KdfSettings = KdfParams & { salt: string };

/** The locked keys the server keeps for an account. */
export interface KeyBundle {
  kdf: KdfSettings;
  protectedUserKey: string;
  publicKey: string;
  protectedPrivateKey: string;
}

/** Keys while the vault is open. Memory only. */
export interface UnlockedKeys {
  userKey: Uint8Array;
  privateKey: Uint8Array;
  publicKey: string;
}

const USER_KEY = "user-key";
const PRIVATE_KEY = "private-key";
const RECOVERY = "recovery-user-key";
const PASSKEY = "passkey-user-key";

const newKdf = (params: KdfParams = DEFAULT_KDF): KdfSettings => ({
  ...params,
  salt: toB64url(randomBytes(16)),
});

const fromSettings = (kdf: KdfSettings): KdfParams => ({
  algorithm: kdf.algorithm,
  memory: kdf.memory,
  iterations: kdf.iterations,
  parallelism: kdf.parallelism,
});

/** The sign-in key and master key for a password, with the account's settings. */
export const signInKeys = async (password: string, kdf: KdfSettings) => {
  const masterKey = await deriveMasterKey(password, fromB64url(kdf.salt), fromSettings(kdf));
  return { masterKey, authKey: toB64url(await deriveAuthKey(masterKey)) };
};

/** Opens the locked keys with the master key. Throws if the password was wrong. */
export const openBundle = async (masterKey: Uint8Array, bundle: KeyBundle): Promise<UnlockedKeys> => {
  const userKey = await unwrapKey(await deriveWrappingKey(masterKey), bundle.protectedUserKey, USER_KEY);
  const privateKey = await unwrapKey(userKey, bundle.protectedPrivateKey, PRIVATE_KEY);
  return { userKey, privateKey, publicKey: bundle.publicKey };
};

/** Opens the private key with an already open user key (passkey unlock, recovery). */
export const openBundleWithUserKey = async (userKey: Uint8Array, bundle: KeyBundle): Promise<UnlockedKeys> => ({
  userKey,
  privateKey: await unwrapKey(userKey, bundle.protectedPrivateKey, PRIVATE_KEY),
  publicKey: bundle.publicKey,
});

/** The user key, wrapped so that only this passkey's PRF secret opens it. */
export const wrapUserKeyForPasskey = async (prfOutput: Uint8Array, userKey: Uint8Array) =>
  wrapKey(await derivePasskeyWrappingKey(prfOutput), userKey, PASSKEY);

export const openUserKeyWithPasskey = async (prfOutput: Uint8Array, token: string) =>
  unwrapKey(await derivePasskeyWrappingKey(prfOutput), token, PASSKEY);

const recoveryParts = async (userKey: Uint8Array) => {
  const recoveryKey = newRecoveryKey();
  return {
    recoveryKey,
    recoveryProtectedUserKey: await wrapKey(await deriveRecoveryWrappingKey(recoveryKey), userKey, RECOVERY),
    recoveryAuth: toB64url(await deriveRecoveryAuthKey(recoveryKey)),
  };
};

/**
 * Everything for switching on end-to-end encryption. `recoveryKey` is shown
 * to the person once; the rest is sent to the server.
 */
export const createAccountKeys = async (password: string, params?: KdfParams) => {
  const kdf = newKdf(params);
  const { masterKey, authKey } = await signInKeys(password, kdf);
  const userKey = newSymmetricKey();
  const pair = await generateKeyPair();
  const recovery = await recoveryParts(userKey);
  return {
    recoveryKey: recovery.recoveryKey,
    request: {
      kdf,
      authKey,
      protectedUserKey: await wrapKey(await deriveWrappingKey(masterKey), userKey, USER_KEY),
      publicKey: pair.publicKey,
      protectedPrivateKey: await wrapKey(userKey, pair.privateKey, PRIVATE_KEY),
      recoveryProtectedUserKey: recovery.recoveryProtectedUserKey,
      recoveryAuth: recovery.recoveryAuth,
    },
    unlocked: { userKey, privateKey: pair.privateKey, publicKey: pair.publicKey } as UnlockedKeys,
  };
};

/** A new master password re-locks the same vault key; nothing else changes. */
export const relockForPassword = async (newPassword: string, userKey: Uint8Array, params?: KdfParams) => {
  const kdf = newKdf(params);
  const { masterKey, authKey } = await signInKeys(newPassword, kdf);
  return {
    kdf,
    authKey,
    protectedUserKey: await wrapKey(await deriveWrappingKey(masterKey), userKey, USER_KEY),
  };
};

/** A fresh recovery key for an open vault. */
export const replaceRecovery = (userKey: Uint8Array) => recoveryParts(userKey);

/** What the server checks before handing out the recovery copy. */
export const recoveryProof = async (recoveryKey: string) =>
  toB64url(await deriveRecoveryAuthKey(recoveryKey));

/** Opens the vault key with the recovery key. Throws if it doesn't match. */
export const openWithRecovery = async (recoveryKey: string, recoveryProtectedUserKey: string) =>
  unwrapKey(await deriveRecoveryWrappingKey(recoveryKey), recoveryProtectedUserKey, RECOVERY);
