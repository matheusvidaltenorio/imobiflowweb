import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const CONNECT_ATTEMPTS = 25;
const CONNECT_DELAY_MS = 2000;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log('Conectado ao PostgreSQL após novas tentativas.');
        }
        return;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `PostgreSQL indisponível (tentativa ${attempt}/${CONNECT_ATTEMPTS}): ${msg}`,
        );
        if (attempt < CONNECT_ATTEMPTS) {
          this.logger.warn(
            'Inicie o banco: na raiz do projeto rode "docker compose up -d" (Docker Desktop aberto) ou ajuste DATABASE_URL em backend/.env para seu Postgres.',
          );
          await new Promise((r) => setTimeout(r, CONNECT_DELAY_MS));
        }
      }
    }
    this.logger.error(
      'Não foi possível conectar ao PostgreSQL. O login e a API dependem do banco estar no ar.',
    );
    throw lastErr instanceof Error
      ? lastErr
      : new Error('Falha ao conectar ao banco de dados após várias tentativas.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
