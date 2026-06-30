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

  invalidateTransporter(): void {
    this.transporter = null;
    this.transporterBuiltAt = 0;
  }

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

  // Expands {{verifyButton}}, {{checkinButton}}, {{cancelButton}} to full
  // button+URL HTML before variable substitution (so URLs are inserted raw,
  // not HTML-escaped by renderTemplateBody).
  private expandButtonPlaceholders(
    body: string,
    vars: Record<string, string>,
  ): string {
    const defs: Array<[string, string, string, string]> = [
      ['verifyButton',  vars['verificationUrl'] ?? '', 'Verify Email',   '#16a34a'],
      ['checkinButton', vars['checkinUrl']       ?? '', 'Check In',       '#2563eb'],
      ['cancelButton',  vars['cancelUrl']        ?? '', 'Cancel Booking', '#dc3545'],
    ];
    let result = body;
    for (const [key, url, label, color] of defs) {
      if (!url || !result.includes(`{{${key}}}`)) continue;
      const safeUrl = url.replaceAll('&', '&amp;');
      result = result.replaceAll(
        `{{${key}}}`,
        `<div style="text-align:center">` +
        `<a href="${safeUrl}" style="background-color:${color};color:white;padding:12px 24px;` +
        `text-decoration:none;border-radius:5px;display:inline-block;font-weight:bold">${label}</a>` +
        `<p style="font-size:13px;color:#666666;text-align:center">` +
        `Or copy and paste this URL into your browser:<br>${safeUrl}</p>` +
        `</div>`,
      );
    }
    return result;
  }

  private async getFromAddress(): Promise<string> {
    return (await this.settingsService.get('smtp_from')) ?? '';
  }

  private async buildHtml(content: string): Promise<string> {
    const footerTpl = await this.templates.getByKey('email_footer');
    const footerText = footerTpl?.body?.trim() ?? '';
    const footer = footerText
      ? `<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px"><p style="font-size:12px;color:#999;text-align:center;font-style:italic">${footerText}</p>`
      : '';
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;text-align:center">${content}${footer}</div>`;
  }

  async sendVerificationEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const verificationUrl = `${this.configService.get<string>('FRONTEND_URL', '')}/verify-email?token=${token}`;
    const tpl = await this.templates.getByKey('registration');
    const vars = { name, verificationUrl };
    const raw = tpl?.body ?? 'Welcome {{name}},<br>Please verify your email address:<br>{{verifyButton}}';
    const body = this.renderTemplateBody(this.expandButtonPlaceholders(raw, vars), vars);
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject: 'Verify Your Email Address',
      html: await this.buildHtml(body),
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', '')}/reset-password?token=${token}`;
    const content = `
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
    `;
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject: 'Reset Your Password',
      html: await this.buildHtml(content),
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendGenericEmail(
    email: string,
    subject: string,
    text: string,
  ): Promise<void> {
    const content = `<p>${this.escapeHtml(text).replaceAll('\n', '<br/>')}</p>`;
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject,
      html: await this.buildHtml(content),
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }

  async sendHtmlEmail(
    email: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject,
      html: await this.buildHtml(html),
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
    // Expand button placeholders first (raw HTML, URL not escaped yet),
    // then substitute remaining {{vars}} with HTML-escaped values.
    const html = this.renderTemplateBody(
      this.expandButtonPlaceholders(tpl?.body ?? '', variables),
      variables,
    );
    // Subject may itself contain {{variables}} (e.g. {{amenity}})
    const rawSubject = tpl?.subject ?? fallbackSubject;
    const subject = this.renderTemplateBody(rawSubject, variables);
    const mailOptions = {
      from: await this.getFromAddress(),
      to: email,
      subject,
      html: await this.buildHtml(html),
    };
    await (await this.getTransporter()).sendMail(mailOptions);
  }
}
