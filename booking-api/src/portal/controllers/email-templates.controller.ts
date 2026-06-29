import { Controller, Get } from '@nestjs/common';
import { EmailTemplatesService } from '../../shared/email-templates/email-templates.service';

@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private readonly svc: EmailTemplatesService) {}

  @Get('registration-legal-text')
  async getRegistrationLegalText() {
    const template = await this.svc.getByKey('registration_legal_text');
    return { text: template?.body || 'Legal note - Account creation' };
  }

  @Get('booking-legal-text')
  async getBookingLegalText() {
    const template = await this.svc.getByKey('booking_legal_text');
    return { text: template?.body || 'Legal note - Booking confirmation' };
  }

  @Get('cancel-page-content')
  async getCancelPageContent() {
    const [confirm, success] = await Promise.all([
      this.svc.getByKey('cancel_page_confirm_text'),
      this.svc.getByKey('cancel_page_success_text'),
    ]);
    return {
      confirmText:
        confirm?.body || 'Are you sure you want to cancel this booking?',
      successText: success?.body || 'Your booking has been cancelled.',
    };
  }

  @Get('checkin-page-content')
  async getCheckinPageContent() {
    const [instructions, success, mismatch] = await Promise.all([
      this.svc.getByKey('checkin_page_instructions'),
      this.svc.getByKey('checkin_success_text'),
      this.svc.getByKey('checkin_mismatch_text'),
    ]);
    return {
      instructions:
        instructions?.body ||
        'Point your camera at the QR code at the amenity.',
      successText:
        success?.body ||
        'You have successfully checked in. Enjoy your booking!',
      mismatchText:
        mismatch?.body || 'QR code does not match. Please try again.',
    };
  }

  @Get('site-footer-text')
  async getSiteFooterText() {
    const template = await this.svc.getByKey('site_footer_text');
    return { text: template?.body || '© {{year}} All rights reserved.' };
  }

  @Get('approval-content')
  async getApprovalContent() {
    const [pendingMessage, loggedInMessage] = await Promise.all([
      this.svc.getByKey('pending_approval_message'),
      this.svc.getByKey('pending_approval_logged_in'),
    ]);
    return {
      pendingMessage:
        pendingMessage?.body ||
        'Your email has been verified. Your account is awaiting admin approval before you can make bookings.',
      loggedInMessage:
        loggedInMessage?.body ||
        'Your account is pending admin approval. You will be notified by email once approved.',
    };
  }
}
