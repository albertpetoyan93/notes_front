import axios from "axios";

const axiosServices = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL || "http://localhost:9000/",
});
export const baseURL =
  import.meta.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/";
// ==============================|| AXIOS - FOR MOCK SERVICES ||============================== //

axiosServices.interceptors.request.use(
  async (config) => {
    const accessToken = localStorage.getItem("access_token");
    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosServices.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.href.includes("/auth/login")
    ) {
      // Clear invalid tokens
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      // Redirect to login
      window.location.href = "/auth/login";
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
