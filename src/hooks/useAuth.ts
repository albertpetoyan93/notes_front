import { useNavigate } from "react-router-dom";
import { fetcherGet, fetcherPost } from "../configs/axios";
import { useAuthStore } from "../store/authStore";
import { message } from "antd";
import { keevoReturnPath } from "../utils/keevoReturn";

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
    navigate(keevoReturnPath() || "/");
  };

  const login = async (newData: any): Promise<LoginChallenge | null> => {
    setStore({ loading: true });
    try {
      const data = await fetcherPost(endpoints.login, newData);
      if (data?.twoFactorRequired) {
        return { challengeToken: data.challengeToken };
      }
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
      await finishSignIn();
    } catch (err: any) {
      message.error(err.message || "That code is not valid.");
      throw err;
    } finally {
      setStore({ loading: false });
    }
  };

  const register = async (newData: any) => {
    setStore({ loading: true });
    try {
      await fetcherPost(endpoints.register, newData);
      message.success("Registration successful!");
      await getMe();
      navigate("/");
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
    verifyTwoFactor,
    register,
    requestPasswordReset,
    resetPassword,
    getMe,
  };
};

export default useAuth;
