import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Endpoints leves para load balancers e monitoramento (sem dados sensíveis).
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  liveness() {
    return {
      status: 'ok',
      service: 'imobflow-api',
      uptimeSec: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', db: 'up', ts: new Date().toISOString() };
  }
}
