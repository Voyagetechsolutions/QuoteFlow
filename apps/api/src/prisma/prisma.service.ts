import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // Non-fatal: let the API boot even with no database yet (scaffold/dev).
    // Real query errors still surface at call time.
    try {
      await this.$connect();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[prisma] could not connect at startup (continuing): ${
          (err as Error).message
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
