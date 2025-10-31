import { useNavigate } from "react-router-dom";
import { fetcherGet, fetcherPost } from "../configs/axios";
import { useAuthStore } from "../store/authStore";
import { message } from "antd";

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
      logOut();
      throw err;
    }
  };

  const login = async (newData: any) => {
    setStore({ loading: true });
    try {
      const response = await fetcherPost(endpoints.login, newData);
      localStorage.setItem("access_token", response.accessToken);
      localStorage.setItem("refresh_token", response.refreshToken);
      await getMe();
      navigate("/");
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
      const response = await fetcherPost(endpoints.register, newData);
      localStorage.setItem("access_token", response.accessToken);
      localStorage.setItem("refresh_token", response.refreshToken);
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

  const logOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/auth/login");
    window.location.reload();
    // // window.location.pathname = "/auth/login";
  };

  return {
    logOut,
    login,
    register,
    getMe,
  };
};

export default useAuth;
