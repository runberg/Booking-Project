import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './email-template.entity';

const DEFAULTS: Record<string, string> = {
  registration:
    'Welcome {{name}},\n\nPlease verify your email to activate your account.',
  booking_confirmation:
    'Hello {{name}},\n\nYour booking for {{amenity}} on {{date}} at {{time}} is confirmed.',
  registration_legal_text: 'Legal note - Account creation',
  booking_legal_text: 'Legal note - Booking confirmation',
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private repo: Repository<EmailTemplate>,
  ) {}

  async getAll(): Promise<Array<{ key: string; body: string }>> {
    // Ensure defaults exist
    await this.ensureDefaults();
    const rows = await this.repo.find();
    return rows.map((r) => ({ key: r.key, body: r.body }));
  }

  async getByKey(key: string): Promise<{ key: string; body: string } | null> {
    await this.ensureDefaults();
    const row = await this.repo.findOne({ where: { key } });
    if (row) return { key: row.key, body: row.body };
    if (DEFAULTS[key]) return { key, body: DEFAULTS[key] };
    return null;
  }

  async upsert(
    key: string,
    body: string,
  ): Promise<{ key: string; body: string }> {
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.body = body;
      const saved = await this.repo.save(existing);
      return { key: saved.key, body: saved.body };
    }
    const created = this.repo.create({ key, body });
    const saved = await this.repo.save(created);
    return { key: saved.key, body: saved.body };
  }

  private async ensureDefaults(): Promise<void> {
    const keys = Object.keys(DEFAULTS);
    for (const key of keys) {
      const found = await this.repo.findOne({ where: { key } });
      if (!found) {
        const created = this.repo.create({ key, body: DEFAULTS[key] });
        await this.repo.save(created);
      }
    }
  }
}
