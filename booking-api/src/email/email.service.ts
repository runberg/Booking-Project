import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailTemplatesService } from '../email-templates/email-templates.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService, private templates: EmailTemplatesService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  private renderTemplateBody(body: string, variables: Record<string, string>): string {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => {
      const val = variables?.[key];
      return val != null ? String(val) : '';
    });
  }

  async sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/verify-email?token=${token}`;
    const tpl = await this.templates.getByKey('registration');
    const body = this.renderTemplateBody(tpl?.body || 'Welcome {{name}}, please verify your email: {{verificationUrl}}', {
      name,
      verificationUrl,
    });
    const mailOptions = {
      from: this.configService.get('SMTP_FROM', 'noreply@bookingapp.com'),
      to: email,
      subject: 'Verify Your Email Address',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><p>${body.replace(/\n/g, '<br/>')}</p></div>`,
    };
    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: this.configService.get('SMTP_FROM', 'noreply@bookingapp.com'),
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

    await this.transporter.sendMail(mailOptions);
  }

  async sendGenericEmail(email: string, subject: string, htmlOrText: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get('SMTP_FROM', 'noreply@bookingapp.com'),
      to: email,
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>${htmlOrText}</p>
      </div>`,
    };
    await this.transporter.sendMail(mailOptions);
  }

  async sendTemplateEmail(email: string, subject: string, key: string, variables: Record<string, string>): Promise<void> {
    const tpl = await this.templates.getByKey(key);
    const body = this.renderTemplateBody(tpl?.body || '', variables);
    return this.sendGenericEmail(email, subject, body.replace(/\n/g, '<br/>'));
  }
}
