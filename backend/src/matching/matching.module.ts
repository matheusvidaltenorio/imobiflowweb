import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchEngineService } from './match-engine.service';
import { MatchSuggestionService } from './match-suggestion.service';
import { InterestProfileService } from './interest-profile.service';
import { MatchingController } from './matching.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MatchingController],
  providers: [MatchEngineService, MatchSuggestionService, InterestProfileService],
  exports: [MatchEngineService, MatchSuggestionService, InterestProfileService],
})
export class MatchingModule {}
