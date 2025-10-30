import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Prefer per-user throttling when authenticated, otherwise fall back to IP
    return (req.user?.id as string) || (req.ip as string) || 'anonymous';
  }
}


