import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './email-template.entity';

type TemplateRecord = { key: string; subject: string | null; body: string };

const DEFAULTS: Record<string, { subject: string; body: string }> = {
  registration: {
    subject: 'Verify Your Email Address',
    body: '<p>Welcome {{name}},</p><p>Please verify your email to activate your account: <a href="{{verificationUrl}}">Verify Email</a></p>',
  },
  booking_confirmation: {
    subject: 'Booking Confirmation',
    body: '<p>Hello {{name}},</p><p>Your booking for <strong>{{amenity}}</strong> on <strong>{{date}}</strong> at <strong>{{time}}</strong> is confirmed.</p>',
  },
  booking_reminder: {
    subject: 'Reminder: Your upcoming booking for {{amenity}}',
    body: '<p>Hello {{name}},</p><p>This is a reminder that you have an upcoming booking:</p><p><strong>{{amenity}}</strong><br>{{date}} at {{time}}</p><div style="text-align:center;margin:24px 0"><a href="{{cancelUrl}}" style="background-color:#dc3545;color:white;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">Cancel Booking</a></div><p style="text-align:center;font-size:12px;color:#666">Or copy this link into your browser:<br>{{cancelUrl}}</p><p>If you plan to attend, no action is needed.</p>',
  },
  registration_legal_text: {
    subject: '',
    body: 'Legal note - Account creation',
  },
  booking_legal_text: {
    subject: '',
    body: 'Legal note - Booking confirmation',
  },
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private repo: Repository<EmailTemplate>,
  ) {}

  async getAll(): Promise<TemplateRecord[]> {
    await this.ensureDefaults();
    const rows = await this.repo.find();
    return rows.map((r) => ({ key: r.key, subject: r.subject, body: r.body }));
  }

  async getByKey(key: string): Promise<TemplateRecord | null> {
    await this.ensureDefaults();
    const row = await this.repo.findOne({ where: { key } });
    if (row) return { key: row.key, subject: row.subject, body: row.body };
    const d = DEFAULTS[key];
    if (d) return { key, subject: d.subject, body: d.body };
    return null;
  }

  async upsert(key: string, body: string, subject?: string): Promise<TemplateRecord> {
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.body = body;
      if (subject !== undefined) existing.subject = subject;
      const saved = await this.repo.save(existing);
      return { key: saved.key, subject: saved.subject, body: saved.body };
    }
    const created = this.repo.create({
      key,
      body,
      subject: subject ?? DEFAULTS[key]?.subject ?? null,
    });
    const saved = await this.repo.save(created);
    return { key: saved.key, subject: saved.subject, body: saved.body };
  }

  private async ensureDefaults(): Promise<void> {
    for (const [key, def] of Object.entries(DEFAULTS)) {
      const found = await this.repo.findOne({ where: { key } });
      if (!found) {
        await this.repo.save(
          this.repo.create({ key, body: def.body, subject: def.subject }),
        );
      }
    }
  }
}
