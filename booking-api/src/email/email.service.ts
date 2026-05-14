import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private transporterBuiltAt = 0;
  private readonly TRANSPORTER_TTL = 60_000;

  constructor(
    private configService: ConfigService,
    private templates: EmailTemplatesService,
    private settingsService: SettingsService,
  ) {}

  private async getTransporter(): Promise<nodemailer.Transporter> {
    const now = Date.now();
    if (this.transporter && now - this.transporterBuiltAt < this.TRANSPORTER_TTL) {
      return this.transporter;
    }

    const [host, port, user, pass] = await Promise.all([
      this.settingsService.get('smtp_host'),
      this.settingsService.get('smtp_port'),
      this.settingsService.get('smtp_user'),
      this.settingsService.get('smtp_pass'),
    ]);

    const resolvedHost = host || this.configService.get('SMTP_HOST', 'smtp.gmail.com');
    const resolvedPort = Number(port || this.configService.get('SMTP_PORT', '587'));
    const secure = resolvedPort === 465;

    this.transporter = nodemailer.createTransport({
      host: resolvedHost,
      port: resolvedPort,
      secure,
      auth: {
        user: user || this.configService.get('SMTP_USER'),
        pass: pass || this.configService.get('SMTP_PASS'),
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 7000,
    } as any);

    this.transporterBuiltAt = now;
    return this.transporter;
  }

  private renderTemplateBody(
    body: string,
    variables: Record<string, string>,
  ): string {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
      const val = variables?.[key];
      return val != null ? String(val) : '';
    });
  }

  private async getFromAddress(): Promise<string> {
    const fromSetting = await this.settingsService.get('smtp_from');
    return fromSetting || this.configService.get('SMTP_FROM', 'noreply@bookingapp.com');
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/verify-email?token=${token}`;
    const tpl = await this.templates.getByKey('registration');
    const body = this.renderTemplateBody(
      tpl?.body ||
        'Welcome {{name}}, please verify your email: {{verificationUrl}}',
      {
        name,
        verificationUrl,
      },
    );
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject: 'Verify Your Email Address',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><p>${body.replace(/\n/g, '<br/>')}</p></div>`,
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${token}`;

    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    };

    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendGenericEmail(
    email: string,
    subject: string,
    htmlOrText: string,
  ): Promise<void> {
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${htmlOrText}</p>
      </div>`,
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendTemplateEmail(
    email: string,
    subject: string,
    key: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const tpl = await this.templates.getByKey(key);
    const body = this.renderTemplateBody(tpl?.body || '', variables);
    return this.sendGenericEmail(email, subject, body.replace(/\n/g, '<br/>'));
  }
}
