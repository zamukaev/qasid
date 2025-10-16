import axios from "axios";
import { encode as btoa } from "base-64";

export const axiosInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_CONTENT_API,
});

axiosInstance.interceptors.request.use(async (config) => {
  const accessToken = await getAccessToken();
  config.headers["x-auth-token"] = accessToken;
  config.headers["x-client-id"] = process.env.EXPO_PUBLIC_CLIENT_ID;
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    if (
      error?.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      const newToken = await getAccessToken(true);
      if (newToken) {
        originalRequest.headers["x-auth-token"] = newToken;
        originalRequest.headers["x-client-id"] =
          process.env.EXPO_PUBLIC_CLIENT_ID;
        return axiosInstance(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

let cachedAccessToken: string | null = null;
let tokenExpiresAtMs = 0;
let refreshingPromise: Promise<string | null> | null = null;

async function getAccessToken(
  forceRefresh: boolean = false
): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < tokenExpiresAtMs) {
    return cachedAccessToken;
  }

  if (refreshingPromise) {
    return refreshingPromise;
  }

  refreshingPromise = fetchNewAccessToken()
    .then((token) => token)
    .finally(() => {
      refreshingPromise = null;
    });

  return refreshingPromise;
}

async function fetchNewAccessToken(): Promise<string | null> {
  const clientId = process.env.EXPO_PUBLIC_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_CLIENT_SECRET;

  const auth = btoa(`${clientId}:${clientSecret}`);

  try {
    const response = await axios({
      method: "post",
      url: process.env.EXPO_PUBLIC_OAUTH_URL,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "grant_type=client_credentials&scope=content",
    });

    const accessToken: string | undefined = response?.data?.access_token;
    const expiresInSec: number | undefined = response?.data?.expires_in;

    if (accessToken) {
      const bufferMs = 60 * 1000;
      const lifetimeMs = (expiresInSec ?? 60 * 60) * 1000;
      tokenExpiresAtMs = Date.now() + Math.max(0, lifetimeMs - bufferMs);
      cachedAccessToken = accessToken;
      return accessToken;
    }

    return null;
  } catch (error) {
    console.error("Error getting access token:", error);
    cachedAccessToken = null;
    tokenExpiresAtMs = 0;
    return null;
  }
}
