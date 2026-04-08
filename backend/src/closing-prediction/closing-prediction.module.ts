import { Global, Module } from '@nestjs/common';
import { ClosingPredictionService } from './closing-prediction.service';
import { ClosingPredictionController } from './closing-prediction.controller';

@Global()
@Module({
  controllers: [ClosingPredictionController],
  providers: [ClosingPredictionService],
  exports: [ClosingPredictionService],
})
export class ClosingPredictionModule {}
