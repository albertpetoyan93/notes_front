import { useNavigate } from "react-router-dom";
import { fetcherGet, fetcherPost } from "../configs/axios";
import { useAuthStore } from "../store/authStore";
import { message } from "antd";
import { returnPath } from "../utils/keevoReturn";
import { isCancelled, signInWithPasskey } from "../utils/passkeys";
import { forgetVaultKeys } from "../store/keyStore";
import { masterKeysFor, openVault } from "../utils/vaultKeys";
import { createAccountKeys } from "../crypto/account";
import { useKeyStore } from "../store/keyStore";
import { masterPasswordProblems } from "../utils/masterPassword";
import { setNewAccountRecovery } from "../utils/newAccount";

// Between the password step and the 2FA step, the master key waits here (memory only).
let pendingMasterKey: Uint8Array | null = null;

export const endpoints = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  getMe: "/api/auth/me",
  verifyTwoFactor: "/api/auth/2fa/verify",
};

/** Set when the password was right and the account has 2FA on. */
export type LoginChallenge = { challengeToken: string };

const useAuth = () => {
  const navigate = useNavigate();
  const { setStore } = useAuthStore();

  const getMe = async () => {
    try {
      const response = await fetcherGet(endpoints.getMe);
      setStore({ me: response });
      return response;
    } catch (err) {
      setStore({ me: null });
      throw err;
    }
  };

  const finishSignIn = async () => {
    await getMe();
    navigate(returnPath() || "/");
  };

  const login = async (newData: any): Promise<LoginChallenge | null> => {
    setStore({ loading: true });
    try {
      // End-to-end accounts: the password never leaves this browser. It becomes
      // a master key (slow on purpose), and only a derived sign-in key is sent.
      const keys = await masterKeysFor(String(newData.email || ""), String(newData.password || ""));
      const body = keys ? { email: newData.email, authKey: keys.authKey } : newData;
      pendingMasterKey = keys?.masterKey || null;
      const data = await fetcherPost(endpoints.login, body);
      if (data?.twoFactorRequired) {
        return { challengeToken: data.challengeToken };
      }
      if (pendingMasterKey) await openVault(pendingMasterKey);
      pendingMasterKey = null;
      await finishSignIn();
      return null;
    } catch (err: any) {
      message.error(err.message || "Login failed");
      console.log(err);
      throw err;
    } finally {
      setStore({ loading: false });
    }
  };

  const verifyTwoFactor = async (challengeToken: string, code: string) => {
    setStore({ loading: true });
    try {
      await fetcherPost(endpoints.verifyTwoFactor, { challengeToken, code });
      if (pendingMasterKey) await openVault(pendingMasterKey);
      pendingMasterKey = null;
      await finishSignIn();
    } catch (err: any) {
      message.error(err.message || "That code is not valid.");
      throw err;
    } finally {
      setStore({ loading: false });
    }
  };

  /**
   * Sign in with a passkey. With `autofill`, it waits quietly until a passkey is picked
   * from the email field's suggestions. Returns false when the person cancelled.
   */
  const loginWithPasskey = async (autofill = false) => {
    try {
      await signInWithPasskey(autofill);
    } catch (err: any) {
      if (isCancelled(err)) return false;
      if (!autofill || err?.message) {
        message.error(err?.message || "Could not sign in with the passkey");
      }
      return false;
    }
    setStore({ loading: true });
    try {
      await finishSignIn();
      return true;
    } finally {
      setStore({ loading: false });
    }
  };

  // Every new account is end-to-end: the keys are made here from the master
  // password, which never leaves this browser. Then the recovery key, once.
  const register = async ({ password, ...newData }: any) => {
    setStore({ loading: true });
    try {
      const problems = await masterPasswordProblems(String(password || ""));
      if (problems.length) throw new Error(`Your master password needs ${problems.join(", and ")}.`);
      const made = await createAccountKeys(String(password));
      await fetcherPost(endpoints.register, { ...newData, e2e: made.request });
      useKeyStore.getState().setKeys(made.unlocked);
      setNewAccountRecovery(made.recoveryKey, String(newData.email || ""));
      await getMe();
      // Keep `?next=` for after the recovery key (a plan picked on the website).
      navigate({ pathname: "/auth/recovery-key", search: window.location.search });
    } catch (err: any) {
      message.error(err.message || "Registration failed");
      console.log(err);
      throw err;
    } finally {
      setStore({ loading: false });
    }
  };

  const requestPasswordReset = async (email: string) => {
    setStore({ loading: true });
    try {
      const data = await fetcherPost("/api/auth/forgot-password", { email });
      return String(data?.message || "");
    } catch (err: any) {
      message.error(err.message || "Could not send the reset email");
      throw err;
    } finally {
      setStore({ loading: false });
    }
  };

  const resetPassword = async (token: string, password: string) => {
    setStore({ loading: true });
    try {
      await fetcherPost("/api/auth/reset-password", { token, password });
      message.success("Password updated. Sign in with the new password.");
      navigate("/auth/login");
    } catch (err: any) {
      message.error(err.message || "Could not reset the password");
      throw err;
    } finally {
      setStore({ loading: false });
    }
  };

  const logOut = async () => {
    forgetVaultKeys();
    try {
      await fetcherPost("/api/auth/logout", {});
    } catch {
      // The cookies are cleared when the server can; still leave the app.
    }
    setStore({ me: null });
    navigate("/auth/login");
    window.location.reload();
  };

  return {
    logOut,
    login,
    loginWithPasskey,
    verifyTwoFactor,
    register,
    requestPasswordReset,
    resetPassword,
    getMe,
  };
};

export default useAuth;
