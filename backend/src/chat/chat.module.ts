import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { VisitsModule } from '../visits/visits.module';
import { LotsModule } from '../lots/lots.module';
import { ProposalsModule } from '../proposals/proposals.module';
import { CatalogShareModule } from '../catalog-share/catalog-share.module';
import { SimulationsModule } from '../simulations/simulations.module';

@Module({
  imports: [VisitsModule, LotsModule, ProposalsModule, CatalogShareModule, SimulationsModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
