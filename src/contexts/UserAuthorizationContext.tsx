import {
  ReactNode,
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { fetcherGet, fetcherPost } from "../configs/axios";
import { useNavigate } from "react-router-dom";

export interface IUserAuthorizationContext {
  user: any | null;
  loading: boolean;
  login: (data: any) => Promise<void>;
  logout: () => void;
  getMe: () => Promise<void>;
}

const UserAuthorizationContext = createContext<
  IUserAuthorizationContext | undefined
>(undefined);

interface UserAuthorizationProviderProps {
  children: ReactNode;
}

export const UserAuthorizationProvider = ({
  children,
}: UserAuthorizationProviderProps) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const getMe = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetcherGet("/api/v1/admin/auth/me");
      setUser(response);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (data: any) => {
    setLoading(true);
    try {
      const response = await fetcherPost("/api/v1/admin/auth/login", data);
      localStorage.setItem("access_token", response.token);
      await getMe();
      navigate("/");
      //   window.location.pathname = "/";
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    navigate("/auth/login", { replace: true });
    // window.location.pathname = "/auth/login";
    // window.location.reload();
  }, []);

  useEffect(() => {
    getMe();
  }, [getMe]);

  return (
    <UserAuthorizationContext.Provider
      value={{ user, loading, login, logout, getMe }}
    >
      {children}
    </UserAuthorizationContext.Provider>
  );
};

export const useUserAuthorization = () => {
  const context = useContext(UserAuthorizationContext);
  if (!context) {
    throw new Error(
      "useUserAuthorization must be used within a UserAuthorizationProvider"
    );
  }
  return context;
};
