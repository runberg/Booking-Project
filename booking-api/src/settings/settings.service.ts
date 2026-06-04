import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Setting } from './setting.entity';

const ALLOWED_KEYS = new Set([
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'reminder_hours_before',
  'checkin_minutes_before',
]);

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache = new Map<string, { v: string | null; at: number }>();
  private readonly TTL = 60_000;

  constructor(
    @InjectRepository(Setting) private repo: Repository<Setting>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const defaults: Record<string, string> = {
      smtp_host: this.configService.get('SMTP_HOST', ''),
      smtp_port: this.configService.get('SMTP_PORT', '587'),
      smtp_user: this.configService.get('SMTP_USER', ''),
      smtp_pass: this.configService.get('SMTP_PASS', ''),
      smtp_from: this.configService.get('SMTP_FROM', ''),
      reminder_hours_before: this.configService.get('REMINDER_HOURS_BEFORE', '24'),
      checkin_minutes_before: this.configService.get('CHECKIN_MINUTES_BEFORE', '30'),
    };
    for (const [key, value] of Object.entries(defaults)) {
      const existing = await this.repo.findOne({ where: { key } });
      if (!existing) {
        await this.repo.save({ key, value: value || null });
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.TTL) return hit.v;
    const row = await this.repo.findOne({ where: { key } });
    const v = row?.value ?? null;
    this.cache.set(key, { v, at: Date.now() });
    return v;
  }

  async set(key: string, value: string | null): Promise<void> {
    if (!ALLOWED_KEYS.has(key)) {
      throw new BadRequestException(`Unknown setting key: ${key}`);
    }
    await this.repo.upsert({ key, value }, ['key']);
    this.cache.delete(key);
  }

  async getSmtpSettings() {
    const [host, port, user, pass, from] = await Promise.all([
      this.get('smtp_host'),
      this.get('smtp_port'),
      this.get('smtp_user'),
      this.get('smtp_pass'),
      this.get('smtp_from'),
    ]);
    return {
      smtp_host: host,
      smtp_port: port,
      smtp_user: user,
      smtp_pass_set: !!pass,
      smtp_from: from,
    };
  }
}
