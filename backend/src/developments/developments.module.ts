import { Module } from '@nestjs/common';
import { DevelopmentsService } from './developments.service';
import { DevelopmentsController } from './developments.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [CloudinaryModule],
  controllers: [DevelopmentsController],
  providers: [DevelopmentsService],
  exports: [DevelopmentsService],
})
export class DevelopmentsModule {}
