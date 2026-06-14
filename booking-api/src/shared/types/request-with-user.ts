import { User } from '../users/user.entity';

export interface RequestWithUser {
  user: User;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}
