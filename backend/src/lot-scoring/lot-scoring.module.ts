import { Global, Module } from '@nestjs/common';
import { LotScoringService } from './lot-scoring.service';

@Global()
@Module({
  providers: [LotScoringService],
  exports: [LotScoringService],
})
export class LotScoringModule {}
