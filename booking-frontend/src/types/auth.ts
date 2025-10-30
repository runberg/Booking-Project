export interface User {
  id: string;
  email: string;
  name: string;
  building: string;
  apartmentNumber: string;
  isEmailVerified: boolean;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  building: string;
  apartmentNumber: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
}
