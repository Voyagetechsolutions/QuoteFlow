import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RateSetsController } from './rate-sets.controller';
import { RateSetsService } from './rate-sets.service';
import { ExtractionService } from './extraction.service';

@Module({
  imports: [PrismaModule],
  controllers: [RateSetsController],
  providers: [RateSetsService, ExtractionService],
  exports: [RateSetsService],
})
export class RateSetsModule {}
