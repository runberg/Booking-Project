import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getInfo() {
    return {
      name: 'Booking API',
      version: '1.0.0',
      description: 'API for booking amenities like badminton, tennis, and paddle courts',
      status: 'running'
    };
  }
}
