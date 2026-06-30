import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplatesService } from '../email-templates/email-templates.service';
import { SettingsService } from '../settings/settings.service';
import { BookingLog } from '../bookings/booking-log.entity';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private transporterBuiltAt = 0;
  private readonly TRANSPORTER_TTL = 60_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly templates: EmailTemplatesService,
    private readonly settingsService: SettingsService,
    @InjectRepository(BookingLog)
    private readonly logRepo: Repository<BookingLog>,
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

  // Expands {{verifyButton}}, {{checkinButton}}, {{cancelButton}},
  // {{resetPasswordButton}} to full button+URL HTML before variable
  // substitution (so URLs are inserted raw, not HTML-escaped by renderTemplateBody).
  private expandButtonPlaceholders(
    body: string,
    vars: Record<string, string>,
  ): string {
    const defs: Array<[string, string, string, string]> = [
      ['verifyButton',        vars['verificationUrl'] ?? '', 'Verify Email',      '#16a34a'],
      ['checkinButton',       vars['checkinUrl']       ?? '', 'Check In',          '#2563eb'],
      ['cancelButton',        vars['cancelUrl']        ?? '', 'Cancel Booking',    '#dc3545'],
      ['resetPasswordButton', vars['resetUrl']         ?? '', 'Reset Password',    '#dc3545'],
      ['adminPanelButton',    vars['adminUrl']         ?? '', 'Go to Admin Panel', '#2563eb'],
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

  // Central send point — logs every delivery attempt and failure.
  // Callers still receive the error so they can decide how to handle it.
  private async dispatch(options: nodemailer.SendMailOptions): Promise<void> {
    try {
      await (await this.getTransporter()).sendMail(options);
      this.logger.log(`Email delivered to ${String(options.to)} — "${options.subject}"`);
    } catch (e: unknown) {
      this.logger.error(
        `Email delivery failed to ${String(options.to)} — "${options.subject}": ${e instanceof Error ? e.message : String(e)}`,
      );
      await this.logEmailFailure(String(options.to ?? ''), String(options.subject ?? ''));
      throw e;
    }
  }

  private async logEmailFailure(to: string, subject: string): Promise<void> {
    try {
      const log = this.logRepo.create({
        action: 'email_failed',
        bookingId: null,
        amenityName: subject, // stores the email subject as context for the admin log
        date: null,
        startTime: null,
        slotLength: null,
        userId: '',
        userEmail: to,
        userName: '',
        building: '',
        apartmentNumber: '',
        ipAddress: null,
      });
      await this.logRepo.save(log);
    } catch (logError: unknown) {
      this.logger.error('Failed to write email_failed log entry', logError);
    }
  }

  private async buildHtml(content: string): Promise<string> {
    const footerTpl = await this.templates.getByKey('email_footer');
    const footerText = footerTpl?.body?.trim() ?? '';
    const footer = footerText
      ? `<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px">` +
        `<p style="font-size:12px;color:#999;text-align:center;font-style:italic">${footerText}</p>`
      : '';
    // <center> is deprecated in HTML5 but is the only reliable centering mechanism
    // across all email clients (including Outlook which ignores CSS text-align inheritance).
    return `<center><div style="font-family:Arial,sans-serif;max-width:600px;text-align:center">${content}${footer}</div></center>`;
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
    await this.dispatch(mailOptions);
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    name: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get<string>('FRONTEND_URL', '')}/reset-password?token=${token}`;
    await this.sendTemplateEmail(email, 'Reset Your Password', 'password_reset', { name, resetUrl });
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
    await this.dispatch(mailOptions);
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
    await this.dispatch(mailOptions);
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
    await this.dispatch(mailOptions);
  }
}
