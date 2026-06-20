import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // Disable Nest's default body parser so we can set explicit size limits.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Security headers (CSP, nosniff, no x-powered-by, etc.).
  app.use(helmet());

  // Body-size limits — generous enough for large rate-set saves (many rows),
  // bounded to blunt oversized-payload abuse. File uploads are capped
  // separately by multer in the upload interceptors.
  app.use(json({ limit: "8mb" }));
  app.use(urlencoded({ extended: true, limit: "8mb" }));

  app.setGlobalPrefix("api");
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`quoteflow-api listening on http://localhost:${port}/api`);
}

void bootstrap();
