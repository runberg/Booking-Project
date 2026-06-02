import axios from 'axios';
import type { AuthResponse, RegisterData, LoginData, ApiResponse } from '../types/auth';

export const API_BASE_URL = (() => {
  const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '';
  if (viteEnv) return viteEnv;
  if (typeof window !== 'undefined') {
    const injected = (window as any).__API_BASE_URL__;
    if (injected) return injected;
    const origin = window.location.origin || '';
    if (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173')) {
      return 'http://localhost:3000';
    }
  }
  return '/api';
})();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh token handling
let isRefreshing = false as boolean;
let pendingRequests: Array<(token: string | null) => void> = [];

const processQueue = (token: string | null) => {
  pendingRequests.forEach((callback) => callback(token));
  pendingRequests = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If unauthorized and we haven't retried yet.
    // Skip refresh logic for auth endpoints — a 401 from /auth/login means wrong
    // credentials, not an expired session. Intercepting it would set the
    // sessionExpired flag and show a misleading "session expired" message.
    const requestUrl: string = originalRequest.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/verify-email') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue the request until refresh completes
        return new Promise((resolve, reject) => {
          pendingRequests.push((token) => {
            if (!token) {
              return reject(error);
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('refreshToken');

      try {
        if (!refreshToken) {
          throw new Error('Missing refresh token');
        }

        const refreshResponse = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        }, {
          headers: { 'Content-Type': 'application/json' },
        });

        const newAccessToken = refreshResponse.data.accessToken;
        const newRefreshToken = refreshResponse.data.refreshToken || refreshToken;

        // Persist new tokens
        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        // Update default header
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;

        // Resume queued requests
        processQueue(newAccessToken);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        // Fail all queued requests and logout
        processQueue(null);
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        } catch {}
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('sessionExpired', '1');
          } catch {}
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    // For non-auth endpoints, a 401 that wasn't handled above (e.g. after a
    // failed retry) means the session is truly gone — clear state and redirect.
    if (error.response?.status === 401 && !isAuthEndpoint) {
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } catch {}
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
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
      // Store tokens
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  async verifyEmail(token: string): Promise<ApiResponse> {
    try {
      const response = await api.post<ApiResponse>('/auth/verify-email', { token });
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
      const response = await api.post<ApiResponse>('/auth/reset-password', { 
        token, 
        newPassword 
      });
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
