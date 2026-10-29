// Company admin recovery (E2E_DESIGN.md section 6, option 2): the company's
// recovery key pair, its private key sealed to each owner and admin, and each
// member's user key sealed to its public key. Every copy is bound to its
// company, key version and (for members) person.
import { E2EError, generateKeyPair, openSealed, sealTo } from "./e2e";

const adminContext = (companyId: number, keyVersion: number) => `company-recovery:${companyId}:${keyVersion}`;
const memberContext = (companyId: number, keyVersion: number, userId: number) =>
  `company-member:${companyId}:${keyVersion}:${userId}`;

/** A new recovery key pair (when turning it on, or replacing it). */
export const newRecoveryPair = () => generateKeyPair();

/** The recovery private key for one owner or admin. */
export const sealRecoveryKey = (adminPublicKey: string, companyId: number, keyVersion: number, privateKey: Uint8Array) =>
  sealTo(adminPublicKey, privateKey, adminContext(companyId, keyVersion));

export const openRecoveryKey = (
  myPrivateKey: Uint8Array,
  myPublicKey: string,
  companyId: number,
  keyVersion: number,
  token: string
) => openSealed(myPrivateKey, myPublicKey, token, adminContext(companyId, keyVersion));

/** A member's user key, for their company's owners and admins to recover. */
export const sealUserKeyForCompany = (
  recoveryPublicKey: string,
  companyId: number,
  keyVersion: number,
  userId: number,
  userKey: Uint8Array
) => sealTo(recoveryPublicKey, userKey, memberContext(companyId, keyVersion, userId));

export const openMemberUserKey = async (
  recoveryPrivateKey: Uint8Array,
  recoveryPublicKey: string,
  companyId: number,
  keyVersion: number,
  userId: number,
  token: string
) => {
  const key = await openSealed(recoveryPrivateKey, recoveryPublicKey, token, memberContext(companyId, keyVersion, userId));
  if (key.length !== 32) throw new E2EError("bad-key");
  return key;
};
