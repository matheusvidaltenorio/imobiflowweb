import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { DevelopmentsModule } from './developments/developments.module';
import { BlocksModule } from './blocks/blocks.module';
import { LotsModule } from './lots/lots.module';
import { VisitsModule } from './visits/visits.module';
import { FavoritesModule } from './favorites/favorites.module';
import { LeadsModule } from './leads/leads.module';
import { PaymentsModule } from './payments/payments.module';
import { InstallmentsModule } from './installments/installments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ClientsModule } from './clients/clients.module';
import { SimulationsModule } from './simulations/simulations.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ContractsModule } from './contracts/contracts.module';
import { SalesModule } from './sales/sales.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { LotScoringModule } from './lot-scoring/lot-scoring.module';
import { CommercialAssistantModule } from './commercial-assistant/commercial-assistant.module';
import { ClosingPredictionModule } from './closing-prediction/closing-prediction.module';
import { MapsModule } from './maps/maps.module';
import { InstagramAdsModule } from './instagram-ads/instagram-ads.module';
import { CampaignStudioModule } from './campaign-studio/campaign-studio.module';
import { SocialModule } from './social/social.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { ttl: 1000, limit: 25 },
      { ttl: 60000, limit: 800 },
    ]),
    PrismaModule,
    LotScoringModule,
    CommercialAssistantModule,
    ClosingPredictionModule,
    MapsModule,
    InstagramAdsModule,
    CampaignStudioModule,
    SocialModule,
    AnalyticsModule,
    CloudinaryModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    DevelopmentsModule,
    BlocksModule,
    LotsModule,
    VisitsModule,
    FavoritesModule,
    LeadsModule,
    PaymentsModule,
    InstallmentsModule,
    DashboardModule,
    ClientsModule,
    SimulationsModule,
    ProposalsModule,
    ContractsModule,
    SalesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
