import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogShareController } from './catalog-share.controller';
import { CatalogShareService } from './catalog-share.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogShareController],
  providers: [CatalogShareService],
  exports: [CatalogShareService],
})
export class CatalogShareModule {}
