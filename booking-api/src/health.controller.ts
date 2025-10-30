import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get() // GET /health
  ping() {
    return { ok: true, ts: Date.now() };
  }
}
