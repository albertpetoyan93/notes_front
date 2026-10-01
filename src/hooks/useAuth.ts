import { useNavigate } from "react-router-dom";
import { fetcherGet, fetcherPost } from "../configs/axios";
import { useAuthStore } from "../store/authStore";
import { message } from "antd";
import { keevoReturnPath } from "../utils/keevoReturn";

export const endpoints = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  getMe: "/api/auth/me",
};

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

  const login = async (newData: any) => {
    setStore({ loading: true });
    try {
      await fetcherPost(endpoints.login, newData);
      await getMe();
      navigate(keevoReturnPath() || "/");
    } catch (err: any) {
      message.error(err.message || "Login failed");
      console.log(err);
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
    register,
    getMe,
  };
};

export default useAuth;
