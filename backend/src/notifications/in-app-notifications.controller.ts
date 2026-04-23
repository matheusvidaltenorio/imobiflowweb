import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

function spTodayStartUtc(): Date {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${iso}T03:00:00.000Z`);
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CORRETOR, UserRole.ADMIN)
export class InAppNotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.prisma.inAppNotification.count({
      where: { userId, readAt: null },
    });
  }

  @Get('availability-summary/today')
  async availabilitySummaryToday(@CurrentUser('id') userId: string) {
    const start = spTodayStartUtc();
    const [grouped, unreadAv] = await Promise.all([
      this.prisma.inAppNotification.groupBy({
        by: ['type'],
        where: {
          userId,
          createdAt: { gte: start },
          type: { startsWith: 'AVAIL_' },
        },
        _count: { _all: true },
      }),
      this.prisma.inAppNotification.count({
        where: {
          userId,
          readAt: null,
          type: { startsWith: 'AVAIL_' },
        },
      }),
    ]);
    return {
      since: start.toISOString(),
      unreadAvailability: unreadAv,
      byType: grouped.map((g) => ({ type: g.type, count: g._count._all })),
    };
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('type') type?: string,
    @Query('typePrefix') typePrefix?: string,
    @Query('developmentId') developmentId?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('from') from?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 100);
    const where: Prisma.InAppNotificationWhereInput = { userId };
    if (type?.trim()) where.type = type.trim();
    else if (typePrefix?.trim()) where.type = { startsWith: typePrefix.trim() };
    if (developmentId?.trim()) where.developmentId = developmentId.trim();
    if (unreadOnly === '1' || unreadOnly === 'true') where.readAt = null;
    if (from?.trim()) {
      const d = new Date(from.trim());
      if (!Number.isNaN(d.getTime())) where.createdAt = { gte: d };
    }
    return this.prisma.inAppNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  @Patch(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.prisma.inAppNotification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }
}
