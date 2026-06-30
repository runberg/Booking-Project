import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './email-template.entity';

type TemplateRecord = { key: string; subject: string | null; body: string };

const DEFAULTS: Record<string, { subject: string; body: string }> = {
  registration: {
    subject: 'Verify Your Email Address',
    body: '<p>Welcome {{name}},</p><p>Please verify your email to activate your account.</p>{{verifyButton}}',
  },
  password_reset: {
    subject: 'Reset Your Password',
    body: '<p>Hi {{name}},</p><p>We received a request to reset your password. Click the button below to create a new password. This link will expire in 1 hour.</p>{{resetPasswordButton}}<p>If you did not request a password reset, please ignore this email.</p>',
  },
  booking_confirmation: {
    subject: 'Booking Confirmation',
    body: '<p>Hello {{name}},</p><p>Your booking for <strong>{{amenity}}</strong> on <strong>{{date}}</strong> at <strong>{{time}}</strong> is confirmed.</p>',
  },
  booking_reminder: {
    subject: 'Reminder: Your upcoming booking for {{amenity}}',
    body: '<p>Hello {{name}},</p><p>This is a reminder that you have an upcoming booking for <strong>{{amenity}}</strong> on <strong>{{date}}</strong> at <strong>{{time}}</strong>.</p>{{cancelButton}}<p>If you plan to attend, no action is needed.</p>',
  },
  booking_checkin: {
    subject: 'Time to check in: {{amenity}}',
    body: '<p>Hello {{name}},</p><p>Your booking for <strong>{{amenity}}</strong> starts at <strong>{{time}}</strong> today.</p>{{checkinButton}}',
  },
  registration_legal_text: {
    subject: '',
    body: 'Legal note - Account creation',
  },
  booking_legal_text: {
    subject: '',
    body: 'Legal note - Booking confirmation',
  },
  cancel_page_confirm_text: {
    subject: '',
    body: 'Are you sure you want to cancel this booking? This will free the slot for other residents.',
  },
  cancel_page_success_text: {
    subject: '',
    body: 'Your booking has been cancelled and the slot is now available for others.',
  },
  checkin_page_instructions: {
    subject: '',
    body: 'Point your camera at the QR code posted at the amenity to confirm your attendance.',
  },
  checkin_success_text: {
    subject: '',
    body: 'You have successfully checked in. Enjoy your booking!',
  },
  checkin_mismatch_text: {
    subject: '',
    body: 'The QR code does not match your booked amenity. Please make sure you are at the correct location and try again.',
  },
  pending_approval_message: {
    subject: '',
    body: 'Your email has been verified. Your account is now awaiting admin approval before you can make bookings. This can take up to 24 hours. You will receive an email once your account has been approved.',
  },
  pending_approval_logged_in: {
    subject: '',
    body: 'Your account is pending admin approval. You will be notified by email once your account has been approved and you can start making bookings.',
  },
  admin_approval_notification: {
    subject: 'Users awaiting admin approval',
    body: '<p>There are currently <strong>{{count}}</strong> user(s) awaiting admin approval.</p><p>Please log in to the admin panel to review and approve or reject them.</p>{{adminPanelButton}}',
  },
  user_approved: {
    subject: 'Your account has been approved',
    body: '<p>Hello {{name}},</p><p>Your account has been approved. You can now log in and start making bookings.</p>',
  },
  user_rejected: {
    subject: 'Account application not approved',
    body: '<p>Hello {{name}},</p><p>Unfortunately your account application has not been approved. Please contact the building management for more information.</p>',
  },
  site_footer_text: {
    subject: '',
    body: '© {{year}} All rights reserved.',
  },
  email_footer: {
    subject: '',
    body: 'This is an automated email that you cannot reply to. For any issues or concerns, kindly reach out to Administration.',
  },
  booking_deleted_by_admin: {
    subject: 'Your booking has been cancelled',
    body: '<p>Hello {{name}},</p><p>Your booking for <strong>{{amenity}}</strong> on {{date}} at {{time}} has been cancelled by an administrator. If you have any questions, please contact building management.</p>',
  },
  user_access_revoked: {
    subject: 'Your booking access has been suspended',
    body: '<p>Hello {{name}},</p><p>Your access to make bookings has been temporarily suspended by an administrator. If you have any questions, please contact building management.</p>',
  },
  user_account_deleted: {
    subject: 'Your account has been removed',
    body: '<p>Hello {{name}},</p><p>Your account has been removed by an administrator. If you believe this is an error, please contact building management.</p>',
  },
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly repo: Repository<EmailTemplate>,
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

  async upsert(
    key: string,
    body: string,
    subject?: string,
  ): Promise<TemplateRecord> {
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
