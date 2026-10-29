import axios from "axios";
import { useBillingStore } from "../store/billingStore";
import { useLockStore } from "../store/lockStore";

const axiosServices = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || "http://localhost:9000/",
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: axiosServices.defaults.baseURL,
  withCredentials: true,
});

export const baseURL =
  import.meta.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/";

localStorage.removeItem("access_token");
localStorage.removeItem("refresh_token");

let refreshPromise: Promise<void> | null = null;

function redirectToLogin() {
  if (window.location.pathname.startsWith("/keevo")) {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
    return;
  }
  if (window.location.pathname.startsWith("/auth/")) return;
  window.location.href = "/auth/login";
}

axiosServices.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = String(original?.url || "");
    const skipRefresh =
      url.includes("/api/auth/login") ||
      url.includes("/api/auth/2fa/verify") ||
      url.includes("/api/auth/passkeys/login") ||
      url.includes("/api/auth/unlock") ||
      // These answer 401 for a wrong master password or recovery key.
      url.includes("/api/auth/e2e/enable") ||
      url.includes("/api/auth/e2e/master-password") ||
      url.includes("/api/auth/e2e/recovery-key") ||
      url.includes("/api/auth/e2e/recover") ||
      url.includes("/api/auth/register") ||
      url.includes("/api/auth/forgot-password") ||
      url.includes("/api/auth/reset-password") ||
      url.includes("/api/auth/refresh") ||
      url.includes("/api/auth/logout");

    // The session is locked (idle time, or locked in another tab): show the lock screen.
    if (status === 423) {
      useLockStore.getState().setLocked(true);
    }

    // An expired access token, not a wrong password: always refresh and retry.
    const expired = error.response?.data?.code === "session_expired";

    if (status === 401 && original && !original._retry && (!skipRefresh || expired)) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshClient
            .post("/api/auth/refresh")
            .then(() => undefined)
            .finally(() => {
              refreshPromise = null;
            });
        }
        await refreshPromise;
        return axiosServices(original);
      } catch {
        redirectToLogin();
      }
    }

    // A plan limit: offer the upgrade. Screens skip their own error for these.
    if (status === 402 && error.response?.data?.code === "plan_limit") {
      const { message, feature, plan } = error.response.data;
      useBillingStore.getState().openUpgrade({ message, feature, plan });
    }

    return Promise.reject(
      (error.response && error.response.data) || "Wrong Services"
    );
  }
);

export default axiosServices;

export const fetcherGet = async (endpoint: string) => {
  const response = await axiosServices.get(endpoint);
  return response.data;
};

export const fetcherPost = async (
  endpoint: string,
  data: any,
  params?: any
) => {
  const response = await axiosServices.post(endpoint, data, params);
  return response.data;
};

export const fetcherPut = async (endpoint: string, data: any, params?: any) => {
  const response = await axiosServices.put(endpoint, data, params);
  return response?.data;
};

export const fetcherDelete = async (endpoint: string) => {
  const response = await axiosServices.delete(endpoint);
  return response.data;
};

export const fetcherFileUpload = async (url: string, { arg }: any) => {
  const res = await axiosServices.post(`${url}`, arg.files, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};
