import { Controller, Get, Param } from '@nestjs/common';
import { EmailTemplatesService } from '../email-templates.service';

@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private svc: EmailTemplatesService) {}

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

  @Get('checkin-page-content')
  async getCheckinPageContent() {
    const [instructions, success, mismatch] = await Promise.all([
      this.svc.getByKey('checkin_page_instructions'),
      this.svc.getByKey('checkin_success_text'),
      this.svc.getByKey('checkin_mismatch_text'),
    ]);
    return {
      instructions: instructions?.body || 'Point your camera at the QR code at the amenity.',
      successText: success?.body || 'You have successfully checked in. Enjoy your booking!',
      mismatchText: mismatch?.body || 'QR code does not match. Please try again.',
    };
  }
}
