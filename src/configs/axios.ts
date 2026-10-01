import axios from "axios";

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
      url.includes("/api/auth/register") ||
      url.includes("/api/auth/refresh") ||
      url.includes("/api/auth/logout");

    if (status === 401 && original && !original._retry && !skipRefresh) {
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
