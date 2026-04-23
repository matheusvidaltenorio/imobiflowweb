import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GestoraPublishMode, Prisma, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GestoraAccessService } from './gestora-access.service';
import { AuditService } from '../audit/audit.service';

@Controller('admin/manager-development-access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class GestoraAccessAdminController {
  constructor(
    private readonly gestoraAccess: GestoraAccessService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('userId') userId?: string, @Query('developmentId') developmentId?: string) {
    return this.gestoraAccess.adminList({ userId, developmentId });
  }

  @Post()
  async create(
    @CurrentUser('id') adminId: string,
    @Body()
    body: {
      userId: string;
      developmentId: string;
      spreadsheetImportEnabled?: boolean;
      assistedImageEnabled?: boolean;
      publishMode?: GestoraPublishMode;
      permissions?: Prisma.InputJsonValue;
    },
  ) {
    const row = await this.gestoraAccess.adminCreate(body);
    await this.audit.log({
      userId: adminId,
      action: 'MANAGER_DEVELOPMENT_ACCESS_CREATED',
      entity: 'ManagerDevelopmentAccess',
      entityId: row.id,
      metadata: { targetUserId: body.userId, developmentId: body.developmentId },
    });
    return row;
  }

  @Patch(':id')
  adminUpdate(
    @Param('id') id: string,
    @Body()
    body: {
      spreadsheetImportEnabled?: boolean;
      assistedImageEnabled?: boolean;
      publishMode?: GestoraPublishMode;
      permissions?: Prisma.InputJsonValue | null;
    },
  ) {
    return this.gestoraAccess.adminUpdate(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    await this.gestoraAccess.adminDelete(id);
    await this.audit.log({
      userId: adminId,
      action: 'MANAGER_DEVELOPMENT_ACCESS_DELETED',
      entity: 'ManagerDevelopmentAccess',
      entityId: id,
    });
    return { ok: true };
  }
}
