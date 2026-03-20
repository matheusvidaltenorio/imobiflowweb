import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'login',
        ttl: 60000,
        limit: 5,
      },
    ]),
    PrismaModule,
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
