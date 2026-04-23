import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InAppNotificationsController } from './in-app-notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [InAppNotificationsController],
})
export class NotificationsModule {}
