import axios from 'axios';
import type { AuthResponse, RegisterData, LoginData, ApiResponse } from '../types/auth';

export const API_BASE_URL = (() => {
  const viteEnv = (import.meta as any).env?.VITE_API_BASE_URL || '';
  if (viteEnv) return viteEnv;
  const injected = (globalThis as any).__API_BASE_URL__;
  if (injected) return injected as string;
  const origin = (globalThis as any).location?.origin || '';
  if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
    return 'http://localhost:3000';
  }
  return '/api';
})();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false as boolean;
let pendingRequests: Array<(token: string | null) => void> = [];

const processQueue = (token: string | null) => {
  pendingRequests.forEach((callback) => callback(token));
  pendingRequests = [];
};

const AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function isAuthEndpoint(url: string): boolean {
  return AUTH_PATHS.some((path) => url.includes(path));
}

function clearAuthStorage(): void {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {}
}

function redirectToLogin(): void {
  const loc = (globalThis as any).location;
  if (loc) loc.href = '/login';
}

function handleSessionExpiry(): void {
  clearAuthStorage();
  try { (globalThis as any).sessionStorage?.setItem('sessionExpired', '1'); } catch {}
  redirectToLogin();
}

function enqueueRequest(originalRequest: any, error: any): Promise<any> {
  return new Promise((resolve, reject) => {
    pendingRequests.push((token) => {
      if (!token) return reject(error);
      originalRequest.headers.Authorization = `Bearer ${token}`;
      resolve(api(originalRequest));
    });
  });
}

async function doTokenRefresh(originalRequest: any): Promise<any> {
  isRefreshing = true;
  const refreshToken = localStorage.getItem('refreshToken');
  try {
    if (!refreshToken) throw new Error('Missing refresh token');
    const resp = await axios.post<AuthResponse>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
    const newAccessToken = resp.data.accessToken;
    const newRefreshToken = resp.data.refreshToken || refreshToken;
    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
    processQueue(newAccessToken);
    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
    return api(originalRequest);
  } catch (refreshErr) {
    processQueue(null);
    handleSessionExpiry();
    throw refreshErr;
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl: string = originalRequest.url || '';

    if (error.response?.status !== 401 || isAuthEndpoint(requestUrl)) {
      throw error;
    }

    if (!originalRequest._retry) {
      originalRequest._retry = true;
      if (isRefreshing) return enqueueRequest(originalRequest, error);
      return doTokenRefresh(originalRequest);
    }

    // Retried request also returned 401 — session is gone
    clearAuthStorage();
    redirectToLogin();
    throw error;
  },
);

export const authService = {
  async register(data: RegisterData): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/auth/register', data);
      return response.data;
    } catch (error: any) {
      const err: Error & { statusCode?: number } = new Error(
        error.response?.data?.message || 'Registration failed',
      );
      err.statusCode = error.response?.status;
      throw err;
    }
  },

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', data);
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  async verifyEmail(token: string): Promise<ApiResponse & { pendingApproval?: boolean }> {
    try {
      const response = await api.post<ApiResponse & { pendingApproval?: boolean }>('/auth/verify-email', { token });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Email verification failed');
    }
  },

  async forgotPassword(email: string): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/auth/forgot-password', { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset request failed');
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/auth/reset-password', { token, newPassword });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset failed');
    }
  },

  async getProfile(): Promise<any> {
    try {
      const response = await api.get('/auth/profile');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get profile');
    }
  },

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },

  getCurrentUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};
