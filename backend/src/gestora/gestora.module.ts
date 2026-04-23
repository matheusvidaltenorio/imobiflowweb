import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { GestoraAccessService } from './gestora-access.service';
import { GestoraController } from './gestora.controller';
import { GestoraAccessAdminController } from './gestora-access-admin.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [GestoraController, GestoraAccessAdminController],
  providers: [GestoraAccessService],
  exports: [GestoraAccessService],
})
export class GestoraModule {}
