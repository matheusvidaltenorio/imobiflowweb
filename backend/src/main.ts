import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/** Em dev, Next.js pode usar 3000, 3001, 3002… — evita CORS ao trocar de porta. */
const LOCALHOST_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function productionAllowedOrigins(): string[] {
  const fromEnv = process.env.FRONTEND_URL?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return fromEnv.length ? fromEnv : ['http://localhost:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const uploadsRoot = join(__dirname, '..', 'uploads');
  app.useStaticAssets(uploadsRoot, {
    prefix: '/uploads/',
    index: false,
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const isProduction = process.env.NODE_ENV === 'production';
  const prodOrigins = productionAllowedOrigins();

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }
      if (isProduction) {
        callback(null, prodOrigins.includes(requestOrigin));
        return;
      }
      if (LOCALHOST_DEV_ORIGIN.test(requestOrigin)) {
        callback(null, true);
        return;
      }
      if (prodOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3333;
  await app.listen(port);
  console.log(`🚀 ImobiFlow API running on port ${port}`);
}

bootstrap();
