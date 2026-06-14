import { User } from '../../users/user.entity';

export class AuthResponseDto {
  user: Omit<User, 'password' | 'hashPassword' | 'validatePassword'>;
  accessToken: string;
  refreshToken: string;
}

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  building: string;
  apartmentNumber: string;
  isEmailVerified: boolean;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
