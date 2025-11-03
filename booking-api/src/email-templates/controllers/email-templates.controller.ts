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
}

