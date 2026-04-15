import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialController } from './social.controller';
import { SocialTokenCryptoService } from './social-token-crypto.service';
import { MetaOAuthService } from './meta-oauth.service';
import { MetaGraphService } from './meta-graph.service';
import { SocialConnectionService } from './social-connection.service';
import { SocialIntegrationLogService } from './social-integration-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [SocialController],
  providers: [
    SocialTokenCryptoService,
    MetaOAuthService,
    MetaGraphService,
    SocialConnectionService,
    SocialIntegrationLogService,
  ],
  exports: [
    SocialTokenCryptoService,
    MetaOAuthService,
    MetaGraphService,
    SocialConnectionService,
    SocialIntegrationLogService,
  ],
})
export class SocialModule {}
