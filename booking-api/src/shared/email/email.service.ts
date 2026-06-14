import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private transporterBuiltAt = 0;
  private readonly TRANSPORTER_TTL = 60_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly templates: EmailTemplatesService,
    private readonly settingsService: SettingsService,
  ) {}

  private async getTransporter(): Promise<nodemailer.Transporter> {
    const now = Date.now();
    if (
      this.transporter &&
      now - this.transporterBuiltAt < this.TRANSPORTER_TTL
    ) {
      return this.transporter;
    }

    const [host, port, user, pass] = await Promise.all([
      this.settingsService.get('smtp_host'),
      this.settingsService.get('smtp_port'),
      this.settingsService.get('smtp_user'),
      this.settingsService.get('smtp_pass'),
    ]);

    const resolvedPort = Number(port || '587');
    const secure = resolvedPort === 465;

    this.transporter = nodemailer.createTransport({
      host: host ?? '',
      port: resolvedPort,
      secure,
      auth: {
        user: user ?? '',
        pass: pass ?? '',
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 7000,
    } satisfies SMTPTransport.Options);

    this.transporterBuiltAt = now;
    return this.transporter;
  }

  private escapeHtml(s: string): string {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  private renderTemplateBody(
    body: string,
    variables: Record<string, string>,
  ): string {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m: string, key: string) => {
      const val = variables[key];
      return val == null ? '' : this.escapeHtml(val);
    });
  }

  private async getFromAddress(): Promise<string> {
    return (await this.settingsService.get('smtp_from')) ?? '';
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL', '')}/verify-email?token=${token}`;
    const tpl = await this.templates.getByKey('registration');
    const body = this.renderTemplateBody(
      tpl?.body ??
        'Welcome {{name}}, please verify your email: {{verificationUrl}}',
      { name, verificationUrl },
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
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', '')}/reset-password?token=${token}`;

    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hi ${this.escapeHtml(name)},</p>
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
    text: string,
  ): Promise<void> {
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${this.escapeHtml(text).replaceAll('\n', '<br/>')}</p>
      </div>`,
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendTemplateEmail(
    email: string,
    fallbackSubject: string,
    key: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const tpl = await this.templates.getByKey(key);
    // Variable values are HTML-escaped inside renderTemplateBody.
    // The template body is stored as sanitized HTML and passes through
    // directly — no additional escaping or \n→<br> conversion.
    const html = this.renderTemplateBody(tpl?.body ?? '', variables);
    // Subject may itself contain {{variables}} (e.g. {{amenity}})
    const rawSubject = tpl?.subject ?? fallbackSubject;
    const subject = this.renderTemplateBody(rawSubject, variables);
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${html}</div>`,
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }
}
