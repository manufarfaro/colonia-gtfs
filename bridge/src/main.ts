import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const port = Number.parseInt(process.env.BRIDGE_PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
