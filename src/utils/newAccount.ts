// A new account's recovery key, between sign-up and the page that shows it
// (memory only: it's never stored anywhere).
let pending: { recoveryKey: string; email: string } | null = null;

export const setNewAccountRecovery = (recoveryKey: string, email: string) => {
  pending = { recoveryKey, email };
};

export const peekNewAccountRecovery = () => pending;

/** Shown and confirmed: forget it. */
export const takeNewAccountRecovery = () => {
  const value = pending;
  pending = null;
  return value;
};
